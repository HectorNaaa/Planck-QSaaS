import { type NextRequest, NextResponse } from "next/server"
import { Executions } from "@/lib/db/client"
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

    // Use internal database to fetch executions
    const allExecutions = Executions.findByUserId(userId)
    
    // Filter by status if provided
    const filtered = statusFilter 
      ? allExecutions.filter((e: { status: string }) => e.status === statusFilter)
      : allExecutions
    
    // Sort by created_at descending
    filtered.sort((a: { created_at: string }, b: { created_at: string }) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    
    // Apply pagination
    const data = filtered.slice(offset, offset + limit)
    const count = filtered.length

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
