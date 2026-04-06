import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/request-utils'
import { Executions } from '@/lib/db/client'

function isGuest(request: NextRequest): boolean {
  return request.cookies.get('planck_guest')?.value === 'true'
}

export async function GET(request: NextRequest) {
  try {
    // Guests get empty stats — no DB query needed
    if (isGuest(request)) {
      return NextResponse.json({
        logs: [],
        twins: [],
        stats: { totalExecutions: 0, successfulExecutions: 0, averageRuntime: 0, successRate: 0, timeRange: '7d' },
      })
    }

    // Check authentication
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get time range from query
    const timeRange = request.nextUrl.searchParams.get('timeRange') || '7d'

    // Parse time range to date
    const now = new Date()
    let startDate: Date
    
    switch (timeRange) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    // Fetch execution logs from SQLite
    const allLogs = Executions.findByUserId(user.id)
    
    // Filter by date range
    const logs = allLogs.filter(log => {
      const logDate = new Date(log.created_at)
      return logDate >= startDate && logDate <= now
    })

    // Calculate stats
    const totalExecutions = logs.length
    const successfulExecutions = logs.filter((l: { status: string }) => l.status === 'completed').length
    const averageRuntime = logs.length > 0 
      ? Math.round(logs.reduce((sum: number, l: { runtime_ms: number }) => sum + (l.runtime_ms || 0), 0) / logs.length)
      : 0
    const successRate = logs.length > 0 
      ? (successfulExecutions / logs.length * 100).toFixed(1)
      : 0

    return NextResponse.json({
      logs: logs.slice(0, 20), // Return last 20 logs
      twins: [], // TODO: Implement digital twins tracking
      stats: {
        totalExecutions,
        successfulExecutions,
        averageRuntime,
        successRate,
        timeRange
      }
    })
  } catch (error) {
    console.error('Dashboard data error:', error)
    return NextResponse.json(
      { error: 'Failed to load data' },
      { status: 500 }
    )
  }
}
