import { NextRequest, NextResponse } from 'next/server'
import { downloadQueue } from '../../../lib/queue'

export async function POST(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get('jobId')
    const candidateId = request.nextUrl.searchParams.get('candidateId')

    if (!jobId && !candidateId) {
      return NextResponse.json({ error: 'Missing jobId or candidateId' }, { status: 400 })
    }

    await downloadQueue.add('download', { jobId, candidateId })
    return NextResponse.json({ message: 'Downloading candidates...' })
  } catch (error) {
    console.error('Error downloading candidates:', error)
    return NextResponse.json(
      { error: 'Failed to download candidates' },
      { status: 500 }
    )
  }
} 