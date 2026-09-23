/**
 * app/api/twins/[id]/duplicate/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/twins/[id]/duplicate — copy a published community twin's
 * *definition* into the caller's private space. Never copies snapshots,
 * run results, or any other user's data.
 */
import { type NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { validateRequestHeaders, createSafeErrorResponse } from "@/lib/security"
import { duplicateTwin } from "@/lib/finance/store"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const headerValidation = validateRequestHeaders(request.headers)
    if (!headerValidation.valid) {
      return NextResponse.json({ success: false, error: headerValidation.error }, { status: 403 })
    }
    const auth = await authenticateRequest(request)
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }
    const { id } = await params
    const twin = duplicateTwin(id, auth.userId!)
    if (!twin) {
      return NextResponse.json({ success: false, error: "Twin not found or not public" }, { status: 404 })
    }
    return NextResponse.json({ success: true, twin })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, "Failed to duplicate twin")
    console.error("[API] twin duplicate error:", error)
    return NextResponse.json({ success: false, error: safeError }, { status: 500 })
  }
}
