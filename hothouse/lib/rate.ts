import { greenhouse } from "./greenhouse";
import { anthropic, RATING_MODEL } from "./anthropic";
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import { Job } from "bullmq";
import { logger } from "./logger";
import { redis } from "./redis";
import { convert } from "./convert";
import { rateQueue } from "./queue";

const db = redis("GENERAL");
const CANDIDATE = readFileSync("/app/CANDIDATE.md", "utf-8");

// Skip the call to the LLM and just set a random score
// Useful for testing without incurring Anthropic costs
const SKIP_RATING = true;

export async function rate(t: Job) {
  const { jobId, candidateId, refresh } = t.data;

  if (!jobId) {
    logger.error("rate: no jobId", { jobId, candidateId, refresh });
    return;
  }

  logger.info("rate: start", { jobId, candidateId, refresh });

  async function setRating(id: string, score: number, data: any) {
    await db.zadd(`candidates:${jobId}`, score, id);
    await db.set(
      `candidate:${jobId}:${id}`,
      JSON.stringify({ id, score, ...data })
    );
  }

  let jobPostDescription = await db.get(`jobPostDescription:${jobId}`);
  if (!jobPostDescription) {
    const jobPostResponse = await greenhouse(`jobs/${jobId}/job_post`);
    const jobPostJson = await jobPostResponse.json();
    jobPostDescription = jobPostJson.content || "";
    if (jobPostDescription) {
      await db.setex(
        `jobPostDescription:${jobId}`,
        60 * 60 * 24,
        jobPostDescription
      );
    }
  }

  let rows: any[] = [];
  if (candidateId) {
    rows = [candidateId];
  } else {
    rows = await db.zrange(`candidates:${jobId}`, 0, -1);
  }

  if (rows.length > 1) {
    logger.debug("rate: queueing multiple jobs", { rows: rows.length });
  } else if (rows.length === 0) {
    logger.error("rate: no rows", { jobId, candidateId });
    return;
  }

  for (const row of rows) {
    const candidate = JSON.parse(
      (await db.get(`candidate:${jobId}:${row}`)) || "{}"
    );
    if (!candidate.id) {
      logger.error("invalid data", { jobId, candidateId, row, candidate });
      await db.zrem(`candidates:${jobId}`, row);
      await db.del(`candidate:${jobId}:${row}`);
      continue;
    }
    const { id, score } = candidate;

    if (rows.length > 1) {
      await rateQueue.add("rate", { jobId, candidateId: id, refresh });
      continue;
    }

    if (!refresh && score) {
      logger.debug("rate: skipping, already scored", { score, ...t.data });
      continue;
    }

    let candidateDetailsJson: any;
    const cachedCandidateDetails = await db.get(`candidateDetails:${id}`);
    if (cachedCandidateDetails) {
      candidateDetailsJson = JSON.parse(cachedCandidateDetails);
    } else {
      const candidateDetails = await greenhouse(`candidates/${id}`);
      candidateDetailsJson = await candidateDetails.json();
      await db.setex(
        `candidateDetails:${id}`,
        60 * 60 * 1,
        JSON.stringify(candidateDetailsJson)
      );
    }

    const name = `${candidateDetailsJson.first_name} ${candidateDetailsJson.last_name}`;

    const openApplication = (candidateDetailsJson.applications || []).find(
      (a: any) => a.status === "active"
    );
    const attachments = openApplication?.attachments;

    if (!attachments) {
      logger.debug("rate: skipping, no attachments", { candidateId: id });
      continue;
    }

    if (SKIP_RATING) {
      logger.warn("rate: skipping due to SKIP_RATING", { ...t.data });
      await setRating(id, Math.round(Math.random() * 100), {
        name,
        notes: "Skipped",
        github: "Skipped",
        linkedin: "Skipped",
        personalSite: "Skipped",
      });
      return;
    }

    await fs.mkdir(`candidates/${id}`, { recursive: true });
    const resume = attachments.find((a) => a.type === "resume");
    const pageFilenames: string[] = [];
    if (resume) {
      const resumeFilenames = await convert(id, resume, "resume");
      pageFilenames.push(...resumeFilenames);
    }

    const coverLetter = attachments.find((a) => a.type === "cover_letter");
    if (coverLetter) {
      const coverLetterFilenames = await convert(
        id,
        coverLetter,
        "cover_letter"
      );
      pageFilenames.push(...coverLetterFilenames);
    }

    const messages = [
      {
        role: "user",
        content: `Rate the attached resume and optional cover letter for the following job post:`,
      },
      {
        role: "user",
        content: [{ type: "text", text: jobPostDescription }],
      },
      {
        role: "user",
        content: await Promise.all(
          pageFilenames.map(async (page: string) => {
            return {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: await fs.readFile(page, "base64"),
              },
            };
          })
        ),
      },
      { role: "assistant", content: "{" },
    ];

    logger.debug("rate: rating", {
      ...t.data,
      name,
      score,
      pageFilenames,
    });

    for (const pageFile of pageFilenames) {
      await fs.unlink(pageFile);
    }

    const response = await anthropic.messages.create({
      model: RATING_MODEL,
      system: CANDIDATE,
      max_tokens: 1024,
      messages,
    });

    const {
      score: newScore,
      notes,
      github,
      linkedin,
      personalSite,
    } = JSON.parse(`{${response.content[0].text}`);

    if (score === null) {
      logger.info("rate: rating", {
        ...t.data,
        name,
        score: newScore,
        notes,
        github,
        linkedin,
        personalSite,
      });
    } else {
      logger.info("rate: updating", {
        ...t.data,
        name,
        score: score ? `${score} -> ${newScore}` : newScore,
        notes,
        github,
        linkedin,
        personalSite,
      });
    }

    await setRating(id, newScore, { notes, github, linkedin, personalSite });
  }
}
