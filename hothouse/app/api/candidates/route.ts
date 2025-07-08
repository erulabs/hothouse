import { NextRequest, NextResponse } from 'next/server'
import { redis } from '../../../lib/redis'

const cache = redis('GENERAL')
const cacheKey = 'candidates'

export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get('jobId')
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }
    const candidates = (await cache.get(`${cacheKey}:${jobId}`)) || []
    return NextResponse.json({ candidates })
  } catch (error) {
    console.error('Error fetching jobs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    )
  }
}