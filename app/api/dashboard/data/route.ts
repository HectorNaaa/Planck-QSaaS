import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/request-utils'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get time range from query
    const timeRange = request.nextUrl.searchParams.get('timeRange') || '7d'

    // Return mock data for now (MVP)
    // In production, query executions_logs and digital_twins from SQLite
    return NextResponse.json({
      logs: [],
      twins: [],
    })
  } catch (error) {
    console.error('Dashboard data error:', error)
    return NextResponse.json(
      { error: 'Failed to load data' },
      { status: 500 }
    )
  }
}
