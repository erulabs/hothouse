import { greenhouse } from "./greenhouse";
import { anthropic } from "./anthropic";
import fs from "node:fs/promises";

export async function rate(jobId: string, candidateId: string, refresh: boolean = false) {

    const jobPostResponse = await greenhouse(`jobs/${jobId}/job_post`);
    const jobPostJson = await jobPostResponse.json();
    const jobPostDescription = jobPostJson.content;

    let rows: any[] = [];
    if (candidateId) {
    rows = await dbAll("SELECT * FROM candidates WHERE id = ?", [ candidateId ]);
    } else {
    rows = await dbAll("SELECT * FROM candidates");
    }
    for (const row of rows) {
    const candidateId = row.id;
    const candidateName = row.name;
    const candidateScore = row.score;
    const resumePages = JSON.parse(row.resume_pages);

    if (!refresh && candidateScore !== null) {
        process.stdout.write("🙈");
        continue;
    }

    const messages = [
        {
        role: "user",
        content: `Rate the attached resume and optional cover letter for the following job post:`,
        },
        {
        role: "user",
        content: [
            {
            type: "text",
            text: jobPostDescription,
            },
        ],
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
        model: "claude-opus-4-20250514",
        system: CANDIDATE,
        max_tokens: 1024,
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
}