/**
 * app/api/finance/[moduleId]/run/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/finance/[moduleId]/run — module-centric contract, kept for demo
 * runs (no saved twin yet) and back-compat. Delegates to the same shared
 * handler as the twin-centric POST /api/twins/[id]/run (no duplicated
 * solver/orchestration logic between the two routes).
 *
 * Body:
 *   { useDemo?: boolean, snapshot?: unknown, scenario: unknown,
 *     computeMode?: "classical" | "quantum-inspired", seed?: number,
 *     twinId?: string, twinName?: string }
 */
import type { NextRequest } from "next/server"
import { executeFinanceRunRequest } from "@/lib/finance/run-handler"

export async function POST(request: NextRequest, { params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params
  return executeFinanceRunRequest(request, { moduleIdParam: moduleId })
}

