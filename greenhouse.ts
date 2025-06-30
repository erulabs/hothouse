#!./node_modules/.bin/tsx --env-file-if-exists=.env

import { createWriteStream, readFileSync, mkdirSync } from "node:fs";
import fs from "node:fs/promises";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import Anthropic from "@anthropic-ai/sdk";
import cliProgress from "cli-progress";

import { pdfToPng } from "pdf-to-png-converter";
import sqlite3 from "sqlite3";
import { program } from "commander";
import util from "node:util";

const GREENHOUSE_AUTH_KEY = process.env.GREENHOUSE_AUTH_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!GREENHOUSE_AUTH_KEY) {
	throw new Error(
		"GREENHOUSE_AUTH_KEY is not set. You can create a .env file with the key.",
	);
}
if (!ANTHROPIC_API_KEY) {
	throw new Error(
		"ANTHROPIC_API_KEY is not set. You can create a .env file with the key.",
	);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const CANDIDATE = readFileSync("CANDIDATE.md", "utf-8");

mkdirSync(`candidates`, { recursive: true });
const db = new sqlite3.Database("candidates/candidates.db");

const dbRun = util.promisify(db.run.bind(db));
const dbAll = util.promisify(db.all.bind(db));
const dbGet = util.promisify(db.get.bind(db));

function greenhouse(path) {
	return fetch(`https://harvest.greenhouse.io/v1/${path}`, {
		headers: {
			Authorization: `Basic ${Buffer.from(`${GREENHOUSE_AUTH_KEY}:`).toString("base64")}`,
		},
	});
}

async function downloadCandidates(jobId) {
	let page = 1;
	console.log("Downloading candidates...");
	while (true) {
		process.stdout.write(`🔄`);
		const applications = await greenhouse(
			`applications?job_id=${jobId}&page=${page}&status=active`,
		);
		const applicationsJson = await applications.json();
		if (applicationsJson.length === 0) {
			console.log("No more candidates");
			break;
		}

		for (const application of applicationsJson) {
			const candidateId = application.candidate_id;

			const existingCandidate = await dbGet(
				"SELECT id FROM candidates WHERE id = ?",
				[candidateId],
			);
			if (existingCandidate) {
				process.stdout.write("🙈");
				continue;
			}

			const candidateDetails = await greenhouse(`candidates/${candidateId}`);
			const candidateDetailsJson = await candidateDetails.json();
			const candidateName = `${candidateDetailsJson.first_name} ${candidateDetailsJson.last_name}`;

			const openApplication = candidateDetailsJson.applications.find(
				(a) => a.status === "active",
			);
			const attachments = openApplication?.attachments;

			if (!attachments) {
				process.stdout.write("✗");
				continue;
			}

			await fs.mkdir(`candidates/${candidateId}`, { recursive: true });
			const resume = attachments.find((a) => a.type === "resume");
			if (resume) {
				const resumeUrl = resume.url;

				const parsedUrl = new URL(resumeUrl);
				const extension = parsedUrl.pathname.split(".").pop();

				const filename = `candidates/${candidateId}/resume.${extension}`;
				const response = await fetch(resumeUrl);

				if (!response.body) {
					throw new Error("No response body");
				}

				process.stdout.write("💾");
				await finished(
					Readable.fromWeb(response.body).pipe(createWriteStream(filename)),
				);

				const pageFilenames: string[] = [];

				if (extension === "pdf") {
					process.stdout.write("🖼️");
					const pages = await pdfToPng(filename, {
						verbosityLevel: 1,
						viewportScale: 2.0,
						useSystemFonts: true,
						disableFontFace: true,
						verbosityLevel: 0,
					});
					for (let i = 0; i < pages.length; i++) {
						const pageFilename = `candidates/${candidateId}/resume-${i}.png`;
						await fs.writeFile(pageFilename, pages[i].content);
						pageFilenames.push(pageFilename);
					}
				} else {
					pageFilenames.push(filename);
				}

				if (pageFilenames.length > 0) {
					await dbRun(
						"INSERT INTO candidates (id, name, resume_pages) VALUES (?, ?, ?)",
						[candidateId, candidateName, JSON.stringify(pageFilenames)],
					);
					process.stdout.write("✓");
				} else {
					process.stdout.write("✗");
				}
			}
		}
		page++;
	}
}

async function setup() {
	db.serialize();
	return dbRun(
		`CREATE TABLE IF NOT EXISTS candidates (
			id INTEGER PRIMARY KEY,
			name TEXT,
			resume_pages TEXT,
			notes TEXT,
			score INTEGER,
			github TEXT,
			personal_site TEXT
		)`,
	);
}

program
	.command("download")
	.option("--job-id <id>", "The job id to download candidates from")
	.action(async (str, options) => {
		const jobId = options.jobId || 2952722;
		await setup();
		await downloadCandidates(jobId);
		db.close();
	});

program.command("list").action(async (str, options) => {
	await setup();
	const rows = await dbAll(
		"SELECT * FROM candidates WHERE score > 50 ORDER BY score DESC",
	);
	console.log({ rows });
	db.close();
});

program.command("rank").action(async (str, options) => {
	await setup();
	const rows = await dbAll("SELECT * FROM candidates");
	for (const row of rows) {
		const candidateId = row.id;
		const candidateName = row.name;
		const candidateScore = row.score;
		const resumePages = JSON.parse(row.resume_pages);

		const pngPages = resumePages.filter((page) => page.endsWith(".png"));
		if (pngPages.length === 0) {
			console.log("No PNG pages", { candidateId, candidateName });
			continue;
		}

		const response = await anthropic.messages.create({
			model: "claude-sonnet-4-20250514",
			system: CANDIDATE,
			max_tokens: 1000,
			messages: [
				{
					role: "user",
					content: `Rate the following candidate's resume: ${candidateName}`,
				},
				{
					role: "user",
					content: await Promise.all(
						resumePages.map(async (page) => {
							return {
								type: "image",
								source: {
									type: "base64",
									media_type: "image/png",
									data: await fs.readFile(page, "base64"),
								},
							};
						}),
					),
				},
				{ role: "assistant", content: "{" },
			],
		});

		const json = JSON.parse(`{${response.content[0].text}`);

		if (candidateScore === null) {
			console.log("Rating", {
				candidateId,
				candidateName,
				score: json.score,
				notes: json.notes,
				github: json.github,
				personalSite: json.personalSite,
			});
		} else {
			console.log("Updating", {
				candidateId,
				candidateName,
				score: `${candidateScore} -> ${json.score}`,
				notes: json.notes,
			});
		}

		await dbRun(
			"UPDATE candidates SET score = ?, notes = ?, github = ?, personal_site = ? WHERE id = ?",
			[json.score, json.notes, json.github, json.personalSite, candidateId],
		);
	}
	db.close();
});

program.command("chat").action(async (str, options) => {
	await setup();
	const rows = await dbAll("SELECT * FROM candidates");
	for (const row of rows) {
		const candidateId = row.id;
		const candidateName = row.name;
		const candidateScore = row.score;
		const candidateNotes = row.notes;
		console.log({ candidateId, candidateName, candidateScore, candidateNotes });
	}
	db.close();
});

program.parse(process.argv);
