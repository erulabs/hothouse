#!./node_modules/.bin/tsx --env-file-if-exists=.env

import {
	createWriteStream,
	createReadStream,
	readFileSync,
	mkdirSync,
} from "node:fs";
import fs from "node:fs/promises";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import Anthropic from "@anthropic-ai/sdk";

import { pdfToPng } from "pdf-to-png-converter";
import sqlite3 from "sqlite3";
import { program } from "commander";
import util from "node:util";
import path from "node:path";
import { exec } from "node:child_process";

const asyncExec = util.promisify(exec);

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

async function downloadAndConvertToImage(candidateId, file, type) {
	const url = file.url;
	const parsedUrl = new URL(url);
	let extension = parsedUrl.pathname.split(".").pop();
	let filename = `candidates/${candidateId}/${type}.${extension}`;

	const response = await fetch(url);

	if (!response.body) {
		throw new Error("No response body");
	}

	process.stdout.write("💾");
	await finished(
		Readable.fromWeb(response.body).pipe(createWriteStream(filename)),
	);

	const pageFilenames: string[] = [];

	if (extension === "docx" || extension === "doc") {
		process.stdout.write("📄");
		const command = await asyncExec(
			`soffice --headless --convert-to pdf ${filename} --outdir ${path.dirname(filename)}`,
		);
		if (command.stderr) {
			console.log({ command: command.stderr });
		} else {
			extension = "pdf";
			filename = `candidates/${candidateId}/${type}.${extension}`;
			process.stdout.write("✓");
		}
	}

	if (extension === "pdf") {
		process.stdout.write("🖼️");
		const pages = await pdfToPng(filename, {
			viewportScale: 2.0,
			useSystemFonts: true,
			disableFontFace: true,
			verbosityLevel: 0,
		});
		for (let i = 0; i < pages.length; i++) {
			const pageFilename = `candidates/${candidateId}/${type}-${i}.png`;
			await fs.writeFile(pageFilename, pages[i].content);
			pageFilenames.push(pageFilename);
		}
	} else {
		console.log("Unknown file type", {
			candidateId,
			extension,
		});
	}
	return pageFilenames;
}

async function downloadCandidates(jobId, candidateId) {
	let page = 1;
	console.log("Downloading candidates...", { jobId, candidateId });
	while (true) {
		process.stdout.write(`🔄`);
		const applicationsResponse = await greenhouse(
			`applications?job_id=${jobId}&page=${page}&status=active`,
		);
		const applicationsJson = await applicationsResponse.json();
		if (applicationsJson.length === 0) {
			console.log("No more candidates");
			break;
		}
		const applications = applicationsJson.filter(
			(a) =>
				a.prospect === false && a.rejected_at === null && a.status === "active",
		);

		for (const application of applications) {
			if (
				candidateId &&
				application.candidate_id !== parseInt(candidateId, 10)
			) {
				continue;
			}

			const existingCandidate = await dbGet(
				"SELECT id FROM candidates WHERE id = ?",
				[application.candidate_id],
			);
			if (existingCandidate) {
				if (candidateId) {
					console.log("Refreshing existing candidate", {
						candidateId: application.candidate_id,
					});
					await dbAll("DELETE FROM candidates WHERE id = ?", [
						application.candidate_id,
					]);
				} else {
					process.stdout.write("🙈");
					continue;
				}
			}

			const candidateDetails = await greenhouse(
				`candidates/${application.candidate_id}`,
			);
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

			await fs.mkdir(`candidates/${application.candidate_id}`, {
				recursive: true,
			});
			const resume = attachments.find((a) => a.type === "resume");
			const pageFilenames: string[] = [];
			if (resume) {
				const resumeFilenames = await downloadAndConvertToImage(
					application.candidate_id,
					resume,
					"resume",
				);
				pageFilenames.push(...resumeFilenames);
			}

			const coverLetter = attachments.find((a) => a.type === "cover_letter");
			if (coverLetter) {
				const coverLetterFilenames = await downloadAndConvertToImage(
					application.candidate_id,
					coverLetter,
					"cover_letter",
				);
				pageFilenames.push(...coverLetterFilenames);
			}

			if (pageFilenames.length > 0) {
				await dbRun(
					"INSERT INTO candidates (id, name, resume_pages) VALUES (?, ?, ?)",
					[
						application.candidate_id,
						candidateName,
						JSON.stringify(pageFilenames),
					],
				);
				process.stdout.write("✓");
			} else {
				process.stdout.write("✗");
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
	.option("--candidate-id <id>", "The candidate id to download")
	.action(async (options) => {
		const jobId = options.jobId || 2952722;
		await setup();
		await downloadCandidates(jobId, options.candidateId);
		db.close();
	});

program
	.command("list")
	.option("--candidate-id <id>", "The candidate id to list")
	.action(async (options) => {
		await setup();
		let rows: any[] = [];
		if (options.candidateId) {
			rows = await dbAll("SELECT * FROM candidates WHERE id = ?", [
				options.candidateId,
			]);
		} else {
			rows = await dbAll("SELECT * FROM candidates ORDER BY score DESC");
		}
		console.log(rows);
		db.close();
	});

program
	.command("rank")
	.option("--candidate-id <id>", "The candidate id to rank")
	.action(async (options) => {
		await setup();
		let rows: any[] = [];
		if (options.candidateId) {
			rows = await dbAll("SELECT * FROM candidates WHERE id = ?", [
				options.candidateId,
			]);
		} else {
			rows = await dbAll("SELECT * FROM candidates");
		}
		for (const row of rows) {
			const candidateId = row.id;
			const candidateName = row.name;
			const candidateScore = row.score;
			const resumePages = JSON.parse(row.resume_pages);

			const messages = [
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
			];

			const response = await anthropic.messages.create({
				model: "claude-sonnet-4-20250514",
				system: CANDIDATE,
				max_tokens: 1000,
				messages,
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

program.command("chat").action(async (options) => {
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

// program.command("delete-files").action(async (str, options) => {
// 	const files = await anthropic.beta.files.list({
// 		betas: ["files-api-2025-04-14"],
// 	});
// 	// console.log({ files });
// 	for (const file of files.data) {
// 		console.log({ file: file.id });
// 		await anthropic.beta.files.delete(file.id, {
// 			betas: ["files-api-2025-04-14"],
// 		});
// 	}
// });

program.parse(process.argv);
