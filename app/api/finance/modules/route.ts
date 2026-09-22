/**
 * app/api/finance/modules/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/finance/modules — lists the registered finance twin modules.
 * Auth required (same session/API-key contract as the rest of the API).
 */
import { type NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { listFinanceModules } from "@/lib/finance/registry"
import { validateRequestHeaders, createSafeErrorResponse } from "@/lib/security"

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
    return NextResponse.json({ success: true, modules: listFinanceModules() })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, "Failed to list finance modules")
    console.error("[API] finance/modules error:", error)
    return NextResponse.json({ success: false, error: safeError }, { status: 500 })
  }
}
