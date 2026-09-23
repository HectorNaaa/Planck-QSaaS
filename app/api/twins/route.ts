/**
 * app/api/twins/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * GET  /api/twins?scope=mine|public&tag=finance — list saved twin *definitions*.
 *   scope=mine (default)   → the caller's own private + published twins.
 *   scope=public            → community-published twins (never another user's
 *                              private twins, snapshots, or run results).
 * POST /api/twins — "Create my twin". Twins are private by default; publishing
 *   is a separate, explicit action (PATCH .../visibility).
 */
import { type NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { validateRequestHeaders, createSafeErrorResponse, sanitizeString } from "@/lib/security"
import { readJsonWithByteLimit, RATE_LIMITER_MAX_PAYLOAD_BYTES } from "@/lib/rate-limiter"
import { getFinanceModule } from "@/lib/finance/registry"
import { createUserTwin, listPublicTwins, listUserTwins, sanitizeTags } from "@/lib/finance/store"

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

    const scope = request.nextUrl.searchParams.get("scope") === "public" ? "public" : "mine"
    const tag = request.nextUrl.searchParams.get("tag") || undefined

    const twins = scope === "public" ? listPublicTwins(tag) : listUserTwins(auth.userId!)
    return NextResponse.json({ success: true, scope, twins })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, "Failed to list twins")
    console.error("[API] twins list error:", error)
    return NextResponse.json({ success: false, error: safeError }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const headerValidation = validateRequestHeaders(request.headers)
    if (!headerValidation.valid) {
      return NextResponse.json({ success: false, error: headerValidation.error }, { status: 403 })
    }

    const bodyRead = await readJsonWithByteLimit(request, RATE_LIMITER_MAX_PAYLOAD_BYTES)
    if (!bodyRead.ok) {
      return NextResponse.json({ success: false, error: bodyRead.error }, { status: bodyRead.status })
    }
    const body = bodyRead.data ?? {}

    const auth = await authenticateRequest(request)
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const moduleDef = getFinanceModule(body.moduleId)
    if (!moduleDef) {
      return NextResponse.json({ success: false, error: `Unknown module: ${body.moduleId}` }, { status: 400 })
    }

    const name = sanitizeString(String(body.name || "").trim(), 120)
    if (!name) {
      return NextResponse.json({ success: false, error: "Twin name is required" }, { status: 400 })
    }
    const description = body.description ? sanitizeString(String(body.description), 500) : null
    const tags = sanitizeTags(body.tags)
    const visibility = body.visibility === "public" ? "public" : "private"

    let config: Record<string, unknown> | null = null
    if (body.config && typeof body.config === "object") {
      // Validate the default scenario shape against the module's own validator up front
      // so a broken "my twin" definition can't be saved.
      try {
        moduleDef.parseScenario(body.config.scenario ?? {})
      } catch (err) {
        return NextResponse.json(
          { success: false, error: `Invalid default scenario: ${err instanceof Error ? err.message : "validation failed"}` },
          { status: 400 },
        )
      }
      config = body.config
    }

    const twin = createUserTwin({
      userId: auth.userId!,
      moduleId: moduleDef.id,
      name,
      description,
      tags,
      config,
      visibility,
    })

    return NextResponse.json({ success: true, twin })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, "Failed to create twin")
    console.error("[API] twins create error:", error)
    return NextResponse.json({ success: false, error: safeError }, { status: 500 })
  }
}
