import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { rateQueue } from "../../../lib/queue";

export async function POST(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");
  const candidateId = request.nextUrl.searchParams.get("candidateId");
  const refresh = request.nextUrl.searchParams.get("refresh");

  if (!jobId && !candidateId) {
    return NextResponse.json(
      { error: "Missing jobId or candidateId" },
      { status: 400 },
    );
  }

  await rateQueue.add("rate", { jobId, candidateId, refresh });

  return NextResponse.json({ message: "Rating candidates..." });
}
