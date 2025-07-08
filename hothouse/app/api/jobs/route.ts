import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { greenhouse } from "@/lib/greenhouse";
import { redis } from "../../../lib/redis";

const cache = redis("GENERAL");
const cacheKey = "job-posts2";

export async function GET(_request: NextRequest) {
  try {
    const cachedJobs = await cache.get(cacheKey);
    if (cachedJobs) {
      return NextResponse.json({ jobs: JSON.parse(cachedJobs) });
    }

    // TODO: Add pagination
    const jobsRequest = await greenhouse("jobs?per_page=500&status=open");
    const jobsJson = await jobsRequest.json();
    const jobs = jobsJson.map((job: { id: string; name: string }) => {
      return {
        id: job.id,
        name: job.name,
      };
    });
    await cache.setex(cacheKey, 60 * 60 * 1, JSON.stringify(jobs));
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 },
    );
  }
}
