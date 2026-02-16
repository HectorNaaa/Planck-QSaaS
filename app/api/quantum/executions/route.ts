import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { authenticateRequest } from "@/lib/api-auth"
import { createSafeErrorResponse, validateRequestHeaders } from "@/lib/security"

/**
 * GET /api/quantum/executions
 *
 * List past executions for the authenticated user.
 * Query params:
 *   limit   – max rows (1-100, default 20)
 *   offset  – pagination offset (default 0)
 *   status  – filter by status (completed | failed | running)
 */
export async function GET(request: NextRequest) {
  try {
    const headerValidation = validateRequestHeaders(request.headers)
    if (!headerValidation.valid) {
      return NextResponse.json(
        { success: false, error: headerValidation.error },
        { status: 403 }
      )
    }

    const auth = await authenticateRequest(request)
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }
    const userId = auth.userId!

    const { searchParams } = new URL(request.url)
    const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit")) || 20))
    const offset = Math.max(0, Number(searchParams.get("offset")) || 0)
    const statusFilter = searchParams.get("status")

    const supabase = await createServerClient()

    let query = supabase
      .from("execution_logs")
      .select(
        "id, circuit_name, algorithm, backend, status, success_rate, runtime_ms, qubits_used, shots, error_mitigation, backend_selected, backend_reason, backend_hint, backend_metadata, backend_assigned_at, created_at, completed_at",
        { count: "exact" }
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (statusFilter && ["completed", "failed", "running"].includes(statusFilter)) {
      query = query.eq("status", statusFilter)
    }

    const { data, error, count } = await query

    if (error) {
      console.error("[API] Executions list error:", error.message)
      return NextResponse.json(
        { success: false, error: "Failed to fetch executions" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      executions: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, "Failed to list executions")
    console.error("[API] Executions error:", error)
    return NextResponse.json(
      { success: false, error: safeError },
      { status: 500 }
    )
  }
}
