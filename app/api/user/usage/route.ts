import { type NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { getEntitlementSummary } from "@/lib/entitlements"
import { createSafeErrorResponse } from "@/lib/security"

/** Returns the authenticated user's own plan/usage summary. Never accepts a
 *  plan/usage value from the client — always read back from the server-side
 *  entitlements ledger keyed by the authenticated userId. */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }
    const summary = getEntitlementSummary(auth.userId!)
    return NextResponse.json({ success: true, usage: summary })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, "Failed to load usage summary")
    console.error("[API] Usage summary error:", error)
    return NextResponse.json({ success: false, error: safeError }, { status: 500 })
  }
}
