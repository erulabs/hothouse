import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { redis } from "../../../lib/redis";

const db = redis("GENERAL");

export async function POST(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");
  const candidateId = request.nextUrl.searchParams.get("candidateId");

  if (!jobId || !candidateId) {
    return NextResponse.json(
      { error: "Missing jobId or candidateId" },
      { status: 400 },
    );
  }

  await db.zrem(`candidates:${jobId}`, candidateId);
  await db.del(`candidate:${jobId}:${candidateId}`);

  return NextResponse.json({ message: "Candidate removed" });
}
