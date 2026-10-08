/**
 * app/api/twins/[id]/run/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/twins/[id]/run — the main twin-centric execution contract:
 *   Twin → snapshot of data → scenario/constraints → execution → KPIs → history.
 *
 * The twin already carries its moduleId (risk-scenario / collateral-liquidity /
 * execution-rfq) and is owner-verified here, so every run under this twin is
 * guaranteed to reuse the same twin instance (never a new one per run).
 * Delegates to the shared handler — no solver logic lives in this route.
 *
 * Body:
 *   { useDemo?: boolean, snapshot?: unknown, scenario: unknown,
 *     computeMode?: "classical" | "quantum-inspired", seed?: number }
 */
import type { NextRequest } from "next/server"
import { executeFinanceRunRequest } from "@/lib/finance/run-handler"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return executeFinanceRunRequest(request, { fixedTwinId: id })
}
