import { NextRequest, NextResponse } from 'next/server'
import { greenhouse } from '@/lib/greenhouse'
import { redis } from '../../../lib/redis'

const cache = redis('GENERAL')
const cacheKey = 'job-posts'

export async function GET(request: NextRequest) {
  try {
    const cachedJobs = await cache.get(cacheKey)
    if (cachedJobs) {
      return NextResponse.json({ jobs: JSON.parse(cachedJobs) })
    }

    const jobsRequest = await greenhouse('job_posts')
    const jobs = (await jobsRequest.json()).map((job: any) => {
      return {
        id: job.id,
        job_id: job.job_id,
        title: job.title,
      }
    })
    await cache.setex(cacheKey, 60 * 60 * 0.5, JSON.stringify(jobs))
    return NextResponse.json({ jobs })
  } catch (error) {
    console.error('Error fetching jobs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    )
  }
} 