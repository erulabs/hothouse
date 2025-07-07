
import { finished } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import { Readable } from "node:stream";
import util from "node:util";
import path from "node:path";
import { exec } from "node:child_process";

import { pdfToPng } from "pdf-to-png-converter";
import { greenhouse } from "./greenhouse";
import { redis } from "./redis";

const cache = redis('GENERAL')
const asyncExec = util.promisify(exec);

export async function downloadAndConvertToImage(candidateId: string, file: any, type: string) {
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
			useSystemFonts: false,
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


export async function downloadCandidates(jobId: string, candidateId: string) {
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
				process.stdout.write("🙈");
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

			if (
				candidateId &&
				application.candidate_id === parseInt(candidateId, 10)
			) {
				break;
			}
		}
		page++;
	}
}
