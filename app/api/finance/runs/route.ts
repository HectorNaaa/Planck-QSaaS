/**
 * app/api/finance/runs/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/finance/runs?module=risk-scenario — tenant-isolated list of the
 * authenticated user's past finance-twin runs.
 */
import { type NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { validateRequestHeaders, createSafeErrorResponse } from "@/lib/security"
import { listRunsForUser } from "@/lib/finance/store"
import { getFinanceModule } from "@/lib/finance/registry"
import type { FinanceModuleId } from "@/lib/finance/types"

export async function GET(request: NextRequest) {
  try {
    const headerValidation = validateRequestHeaders(request.headers)
    if (!headerValidation.valid) {
      return NextResponse.json({ success: false, error: headerValidation.error }, { status: 403 })
    }
    const auth = await authenticateRequest(request)
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const moduleParam = request.nextUrl.searchParams.get("module")
    const moduleId = moduleParam && getFinanceModule(moduleParam) ? (moduleParam as FinanceModuleId) : undefined

    const rows = listRunsForUser(auth.userId!, moduleId)
    const runs = (rows as any[]).map((r) => ({
      id: r.id,
      moduleId: r.module_id,
      executionMode: r.execution_mode,
      solverActual: r.solver_actual,
      status: r.status,
      isSynthetic: !!r.is_synthetic,
      kpis: r.kpis ? JSON.parse(r.kpis) : null,
      result: r.result ? JSON.parse(r.result) : null,
      warnings: r.warnings ? JSON.parse(r.warnings) : [],
      startedAt: r.started_at,
      completedAt: r.completed_at,
      createdAt: r.created_at,
    }))

    return NextResponse.json({ success: true, runs })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, "Failed to list finance runs")
    console.error("[API] finance/runs error:", error)
    return NextResponse.json({ success: false, error: safeError }, { status: 500 })
  }
}
