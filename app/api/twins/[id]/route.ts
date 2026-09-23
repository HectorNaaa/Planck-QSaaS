/**
 * app/api/twins/[id]/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * GET   — twin detail (owner, or anyone if published publicly).
 * PATCH — update the twin's definition, and/or publish/unpublish it
 *         (`visibility: "private" | "public"`). Owner-only. Publishing never
 *         exposes snapshots, run results, or any user data — only the
 *         reusable definition (name/description/tags/config).
 * DELETE — owner-only; cascades to snapshots/runs via FK ON DELETE CASCADE.
 */
import { type NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { validateRequestHeaders, createSafeErrorResponse, sanitizeString } from "@/lib/security"
import { readJsonWithByteLimit, RATE_LIMITER_MAX_PAYLOAD_BYTES } from "@/lib/rate-limiter"
import { getFinanceModule } from "@/lib/finance/registry"
import { deleteTwin, getReadableTwin, setTwinVisibility, updateTwin } from "@/lib/finance/store"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const twin = getReadableTwin(id, auth.userId!)
    if (!twin) {
      return NextResponse.json({ success: false, error: "Twin not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true, twin })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, "Failed to load twin")
    console.error("[API] twin detail error:", error)
    return NextResponse.json({ success: false, error: safeError }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const { id } = await params

    if (body.visibility === "private" || body.visibility === "public") {
      const twin = setTwinVisibility(id, auth.userId!, body.visibility)
      if (!twin) {
        return NextResponse.json({ success: false, error: "Twin not found or not owned by you" }, { status: 404 })
      }
      return NextResponse.json({ success: true, twin })
    }

    const patch: { name?: string; description?: string | null; tags?: string[]; config?: Record<string, unknown> | null } = {}
    if (typeof body.name === "string") patch.name = sanitizeString(body.name.trim(), 120)
    if (body.description !== undefined) patch.description = body.description ? sanitizeString(String(body.description), 500) : null
    if (Array.isArray(body.tags)) patch.tags = body.tags
    if (body.config !== undefined) {
      if (body.config && typeof body.config === "object") {
        const moduleDef = getFinanceModule(body.moduleId)
        if (moduleDef) {
          try {
            moduleDef.parseScenario(body.config.scenario ?? {})
          } catch (err) {
            return NextResponse.json(
              { success: false, error: `Invalid default scenario: ${err instanceof Error ? err.message : "validation failed"}` },
              { status: 400 },
            )
          }
        }
      }
      patch.config = body.config
    }

    const twin = updateTwin(id, auth.userId!, patch)
    if (!twin) {
      return NextResponse.json({ success: false, error: "Twin not found or not owned by you" }, { status: 404 })
    }
    return NextResponse.json({ success: true, twin })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, "Failed to update twin")
    console.error("[API] twin update error:", error)
    return NextResponse.json({ success: false, error: safeError }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const deleted = deleteTwin(id, auth.userId!)
    if (!deleted) {
      return NextResponse.json({ success: false, error: "Twin not found or not owned by you" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, "Failed to delete twin")
    console.error("[API] twin delete error:", error)
    return NextResponse.json({ success: false, error: safeError }, { status: 500 })
  }
}
