import type { Job } from "bullmq";

import { greenhouse } from "./greenhouse";
import { redis } from "./redis";
import { logger } from "./logger";
import { rateQueue } from "./queue";

const db = redis("GENERAL");

export async function downloadCandidates(t: Job) {
  let page = 1;
  const { jobId, candidateId } = t.data;
  logger.info("download: start", { jobId, candidateId });
  while (true) {
    logger.debug("download: fetching candidates", { jobId, candidateId, page });
    const applicationsResponse = await greenhouse(
      `applications?job_id=${jobId}&page=${page}&status=active`,
    );
    const applicationsJson = await applicationsResponse.json();
    if (applicationsJson.length === 0) {
      logger.debug("download: no more candidates", {
        jobId,
        candidateId,
        page,
      });
      break;
    }
    const applications = applicationsJson.filter(
      (a: any) =>
        a.prospect === false && a.rejected_at === null && a.status === "active",
    );
    let candidatesAdded = 0;
    for (const application of applications) {
      if (
        candidateId &&
        application.candidate_id !== parseInt(candidateId, 10)
      ) {
        logger.debug("download: skipping", {
          candidateId: application.candidate_id,
        });
        continue;
      }

      const existingCandidate = await db.zscore(
        `candidates:${jobId}`,
        application.candidate_id,
      );
      if (existingCandidate) {
        if (candidateId) {
          logger.info("download: refreshing existing candidate", {
            candidateId: application.candidate_id,
          });
          await db.zrem(`candidates:${jobId}`, application.candidate_id);
        } else {
          logger.debug("download: skipping", {
            candidateId: application.candidate_id,
          });
          continue;
        }
      }

      await db.zadd(`candidates:${jobId}`, 0, application.candidate_id);
      await db.set(
        `candidate:${jobId}:${application.candidate_id}`,
        JSON.stringify({ id: application.candidate_id }),
      );
      candidatesAdded++;

      if (
        candidateId &&
        application.candidate_id === parseInt(candidateId, 10)
      ) {
        break;
      }
    }

    logger.info("download: candidates added", {
      jobId,
      candidatesAdded,
    });
    await rateQueue.add("rate", { jobId });
    page++;
  }
}
