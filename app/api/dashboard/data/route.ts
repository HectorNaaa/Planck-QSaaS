import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { Executions } from '@/lib/db/client'

/**
 * Normalise a raw SQLite execution row into the ExecutionRow shape the client
 * expects.  Mirrors the toClientRow() function in the SSE stream route.
 */
function toClientRow(r: any) {
  let parsed: any = null
  try { parsed = r.circuit_data ? JSON.parse(r.circuit_data) : null } catch { /* keep null */ }
  return {
    id:               r.id,
    circuit_name:     r.circuit_name   ?? '',
    algorithm:        r.algorithm      ?? '',
    status:           r.status         ?? 'pending',
    qubits_used:      r.qubits_used    ?? 0,
    runtime_ms:       r.runtime_ms     ?? 0,
    success_rate:     r.success_rate   ?? 0,
    backend_selected: r.backend_selected ?? null,
    created_at:       new Date(r.created_at ?? Date.now()).toISOString(),
    digital_twin_id:  parsed?.digital_twin_id ?? null,
    shots:            r.shots          ?? 0,
    error_mitigation: r.error_mitigation ?? null,
    circuit_data: parsed ? {
      source:         parsed.source,
      fidelity:       parsed.results?.fidelity ?? null,
      counts:         parsed.results?.counts   ?? null,
      qasm:           parsed.qasm              ?? null,
      backend_reason: parsed.backend_reason    ?? null,
      ml_tuning:      parsed.ml_tuning         ?? null,
    } : null,
    // Scenario fields
    scenario_id:      r.scenario_id      ?? null,
    scenario_name:    r.scenario_name    ?? null,
    scenario_type:    r.scenario_type    ?? null,
    objective:        r.objective        ?? null,
    risk_tolerance:   r.risk_tolerance   ?? null,
    batch_id:         r.batch_id         ?? null,
    batch_index:      r.batch_index      ?? null,
    batch_size:       r.batch_size       ?? null,
    strategy:         r.strategy         ?? null,
    compute_route:    r.compute_route    ?? null,
  }
}

export async function GET(request: NextRequest) {
  try {
    // Use the canonical authenticateRequest helper — this self-heals the user
    // row so that the dashboard query always uses the same userId that
    // execution writes use.
    const auth = await authenticateRequest(request)

    if (!auth.ok) {
      // Check guest cookie and return empty stats
      const guestCookie = request.cookies.get('planck_guest')?.value
      if (guestCookie === 'true') {
        return NextResponse.json({
          logs: [],
          twins: [],
          stats: { totalExecutions: 0, successfulExecutions: 0, averageRuntime: 0, successRate: 0, timeRange: '7d' },
          userId: null,
        })
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = auth.userId!

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
    const allLogs = Executions.findByUserId(userId)
    console.log(`[DASHBOARD] Found ${allLogs.length} total executions for user ${userId} (timeRange=${timeRange})`)
    
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
      logs: logs.map(toClientRow),
      twins: [], // TODO: Implement digital twins tracking
      stats: {
        totalExecutions,
        successfulExecutions,
        averageRuntime,
        successRate,
        timeRange
      },
      userId,
    })
  } catch (error) {
    console.error('Dashboard data error:', error)
    return NextResponse.json(
      { error: 'Failed to load data' },
      { status: 500 }
    )
  }
}
