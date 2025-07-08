import { NextRequest, NextResponse } from "next/server";
import { Job } from "bullmq";
import { redis } from "../../../lib/redis";
import { rateQueue } from "@/lib/queue";
import { logger } from "@/lib/logger";
import { downloadCandidates } from "@/lib/download";

const db = redis("GENERAL");
const cacheKey = "candidates";

export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get("jobId");
    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }
    let candidatesRaw = await db.zrange(`${cacheKey}:${jobId}`, 0, -1);
    let candidateIds = candidatesRaw.map((c) => JSON.parse(c));

    if (candidateIds.length === 0) {
      logger.debug("candidates: no candidates found, adding to rate queue", {
        jobId,
      });
      await downloadCandidates({ data: { jobId } } as Job);

      candidatesRaw = await db.zrange(`${cacheKey}:${jobId}`, 0, -1);
      candidateIds = candidatesRaw.map((c) => JSON.parse(c));
    }

    if (candidateIds.length === 0) {
      return NextResponse.json({ candidates: [] });
    }

    const candidatesData = await db.mget(
      ...candidateIds.map((c) => `candidate:${jobId}:${c}`)
    );
    const candidates = candidatesData
      .map((c) => JSON.parse(c || "{}"))
      .filter((c) => c.score !== undefined);

    if (candidates.filter((c) => c.score === undefined).length > 0) {
      logger.debug("candidates: some unrated, adding to rate queue", {
        jobId,
      });
      await rateQueue.add("rate", { jobId });
    }

    return NextResponse.json({
      candidates: candidates.sort((a, b) =>
        a.score === undefined
          ? 1
          : b.score === undefined
          ? -1
          : b.score - a.score
      ),
    });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}
