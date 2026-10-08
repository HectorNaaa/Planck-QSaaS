/**
 * lib/finance/run-handler.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single shared implementation of "execute a finance twin" used by both
 * route contracts:
 *   - POST /api/twins/[id]/run        (twin-centric — the main contract)
 *   - POST /api/finance/[moduleId]/run (module-centric — demo runs + back-compat)
 *
 * Route handlers only authenticate/validate/delegate; this is the one place
 * that reserves quota, validates snapshot/scenario, calls executeFinanceRun,
 * and persists twin/snapshot/run rows. Do not duplicate this logic elsewhere.
 */
import { type NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { validateRequestHeaders, createSafeErrorResponse } from "@/lib/security"
import { checkRateLimit, getRetryAfter, readJsonWithByteLimit, RATE_LIMITER_MAX_PAYLOAD_BYTES } from "@/lib/rate-limiter"
import { getFinanceModule } from "@/lib/finance/registry"
import { computeSnapshotHash } from "@/lib/finance/hash"
import { seedFromString } from "@/lib/finance/random"
import { executeFinanceRun } from "@/lib/finance/run"
import { createTwin, createSnapshot, getOwnedTwin, saveRun } from "@/lib/finance/store"
import { reserveQuota, commitReservation, releaseReservation, QuotaExceededError } from "@/lib/entitlements"
import { Executions } from "@/lib/db/client"
import {
  buildRiskScenarioDemoSnapshot,
  buildCollateralLiquidityDemoSnapshot,
  buildExecutionRfqDemoSnapshot,
  DEMO_SEED,
} from "@/lib/finance/demo-data"
import type { FinanceModuleId } from "@/lib/finance/types"

const MODEL_VERSION = "finance-twins@2026.09.22"

function loadDemoSnapshot(moduleId: FinanceModuleId): unknown {
  switch (moduleId) {
    case "risk-scenario": return buildRiskScenarioDemoSnapshot()
    case "collateral-liquidity": return buildCollateralLiquidityDemoSnapshot()
    case "execution-rfq": return buildExecutionRfqDemoSnapshot()
  }
}

export interface FinanceRunRequestOptions {
  /** Module-centric contract: moduleId comes from the route param. */
  moduleIdParam?: string
  /** Twin-centric contract: twin already resolves its own moduleId; `body.twinId` is ignored. */
  fixedTwinId?: string
}

export async function executeFinanceRunRequest(request: NextRequest, opts: FinanceRunRequestOptions): Promise<NextResponse> {
  let reservationId: string | null = null
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
    const userId = auth.userId!

    if (!checkRateLimit(userId)) {
      const retryAfter = Math.ceil(getRetryAfter(userId) / 1000)
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded. Please wait before making another request.", retry_after_seconds: retryAfter },
        { status: 429, headers: { "Retry-After": retryAfter.toString() } },
      )
    }

    // ── Resolve the twin (if twin-centric) and its module ──────────────────
    let fixedTwin: ReturnType<typeof getOwnedTwin> = null
    let moduleId: FinanceModuleId
    if (opts.fixedTwinId) {
      fixedTwin = getOwnedTwin(opts.fixedTwinId, userId)
      if (!fixedTwin) {
        return NextResponse.json({ success: false, error: "Twin not found or not owned by you" }, { status: 404 })
      }
      moduleId = fixedTwin.moduleId
    } else {
      const moduleDefCheck = getFinanceModule(opts.moduleIdParam ?? "")
      if (!moduleDefCheck) {
        return NextResponse.json({ success: false, error: `Unknown finance module: ${opts.moduleIdParam}` }, { status: 404 })
      }
      moduleId = moduleDefCheck.id
    }
    const moduleDef = getFinanceModule(moduleId)!

    const useDemo = body.useDemo === true
    const isSynthetic = useDemo || body.isSynthetic === true
    let snapshot: unknown
    try {
      snapshot = moduleDef.parseSnapshot(useDemo ? loadDemoSnapshot(moduleId) : body.snapshot)
    } catch (err) {
      return NextResponse.json(
        { success: false, error: `Invalid snapshot: ${err instanceof Error ? err.message : "validation failed"}` },
        { status: 400 },
      )
    }
    let scenario: unknown
    try {
      scenario = moduleDef.parseScenario(body.scenario ?? {})
    } catch (err) {
      return NextResponse.json(
        { success: false, error: `Invalid scenario: ${err instanceof Error ? err.message : "validation failed"}` },
        { status: 400 },
      )
    }

    const snapshotHash = computeSnapshotHash(snapshot)
    const seed = typeof body.seed === "number" ? body.seed : (useDemo ? DEMO_SEED : seedFromString(snapshotHash))
    // `computeMode` is the canonical field (matches SDK/web contract); `executionMode` is a legacy alias.
    const computeMode = body.computeMode ?? body.executionMode
    const requestExperimental = computeMode === "quantum-inspired"

    // ── Quota gate: reserve BEFORE running, fail closed on any error ──────
    try {
      reservationId = reserveQuota(userId, "execution", 1)
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        return NextResponse.json(
          {
            success: false,
            error: `Execution quota exceeded for plan "${err.plan}" (${err.used}/${err.limit} this cycle).`,
            quota_exceeded: true,
          },
          { status: 429 },
        )
      }
      console.error("[API] Quota reservation failed — failing closed:", err)
      return NextResponse.json({ success: false, error: "Unable to verify quota right now. Please try again shortly." }, { status: 503 })
    }

    // Reuse a saved twin (a real, re-runnable instance) instead of creating a new
    // throwaway twin row on every single run.
    let twinId: string
    if (fixedTwin) {
      twinId = fixedTwin.id
    } else if (typeof body.twinId === "string" && body.twinId) {
      const owned = getOwnedTwin(body.twinId, userId)
      if (!owned || owned.moduleId !== moduleId) {
        if (reservationId) { try { releaseReservation(reservationId) } catch { /* already settled */ } }
        return NextResponse.json({ success: false, error: "Twin not found or not owned by you" }, { status: 404 })
      }
      twinId = owned.id
    } else {
      twinId = createTwin(userId, moduleId, body.twinName || `${moduleDef.name} (${useDemo ? "demo" : "custom"})`)
    }

    const snapshotId = createSnapshot({
      userId,
      twinId,
      moduleId,
      snapshotHash,
      model: MODEL_VERSION,
      constraints: null,
      data: snapshot,
      isSynthetic,
      seed,
    })

    const runResult = executeFinanceRun({
      moduleId,
      moduleDef,
      snapshot,
      scenario,
      seed,
      isSynthetic,
      snapshotId,
      snapshotHash,
      twinId,
      modelVersion: MODEL_VERSION,
      requestExperimental,
    })

    // Commit the execution slot regardless of outcome (it was consumed either way);
    // then meter compute_ms post-hoc since duration is only known after running.
    commitReservation(reservationId)
    try {
      const computeReservation = reserveQuota(userId, "compute_ms", Math.max(1, runResult.timingsMs.execute))
      commitReservation(computeReservation)
    } catch {
      // compute_ms is metering/reporting only here — never blocks a run that already executed.
    }

    const execRow = Executions.create({
      user_id: userId,
      circuit_name: body.twinName || (fixedTwin ? fixedTwin.name : moduleDef.name),
      algorithm: `finance:${moduleId}`,
      execution_type: "finance",
      backend: "classical",
      status: runResult.status === "completed" ? "completed" : runResult.status === "failed" ? "failed" : "completed",
      result: JSON.stringify({ runId: runResult.runId, moduleId, isSynthetic }),
      scenario_id: runResult.runId,
      scenario_type: "Custom",
      strategy: "single",
      compute_route: runResult.executionMode,
    })

    saveRun({ userId, executionId: execRow.id, snapshotId, moduleId, run: runResult })

    return NextResponse.json({ success: true, run: runResult })
  } catch (error) {
    // Best-effort release if we reserved but crashed before committing.
    if (reservationId) {
      try { releaseReservation(reservationId) } catch { /* already settled */ }
    }
    const safeError = createSafeErrorResponse(error, "Failed to run finance twin")
    console.error("[API] finance run error:", error)
    return NextResponse.json({ success: false, error: safeError }, { status: 500 })
  }
}
