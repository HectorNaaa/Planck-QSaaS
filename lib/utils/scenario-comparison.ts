/**
 * lib/utils/scenario-comparison.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared helper for computing baseline-vs-latest scenario comparison.
 * Used by both the dashboard and the Twin Simulator results view.
 */

import type { ExecutionRow } from "@/hooks/use-live-executions"

export interface ScenarioComparisonData {
  baseline: ExecutionRow
  latest: ExecutionRow
  runtimeDelta: string | null
  reliabilityDelta: string | null
  avgSuccessRate: number
  avgRuntime: number
  computeRoute: string | null
  rowCount: number
}

/** Friendly label for backend_selected values. */
export function routeLabel(r: string | null | undefined): string {
  if (!r) return "—"
  if (r === "quantum_inspired_gpu") return "QI-GPU"
  if (r === "hpc_gpu") return "QI-HPC"
  if (r === "quantum_qpu") return "QPU"
  return r
}

/**
 * Compute comparison data from a list of execution rows.
 * Returns null if there are fewer than 2 completed/saved runs.
 */
export function computeScenarioComparison(rows: ExecutionRow[]): ScenarioComparisonData | null {
  const done = rows.filter((r) => r.status === "completed" || r.status === "saved")
  const n = done.length
  if (n < 2) return null

  // Sort ascending by created_at so [0] = oldest (baseline), [n-1] = newest (latest)
  const sorted = [...done].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
  const baseline = sorted[0]
  const latest = sorted[n - 1]

  const runtimeDelta =
    latest.runtime_ms != null &&
    baseline.runtime_ms != null &&
    baseline.runtime_ms !== 0
      ? (((latest.runtime_ms - baseline.runtime_ms) / baseline.runtime_ms) * 100).toFixed(1)
      : null

  const reliabilityDelta =
    latest.success_rate != null && baseline.success_rate != null
      ? (latest.success_rate - baseline.success_rate).toFixed(1)
      : null

  const avgSuccessRate = done.reduce((s, r) => s + (r.success_rate || 0), 0) / n
  const avgRuntime = done.reduce((s, r) => s + (r.runtime_ms || 0), 0) / n

  // Most-used compute route across all done rows
  const routeCounts = new Map<string, number>()
  for (const r of done) {
    if (r.backend_selected) {
      routeCounts.set(r.backend_selected, (routeCounts.get(r.backend_selected) ?? 0) + 1)
    }
  }
  const computeRoute =
    [...routeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    baseline,
    latest,
    runtimeDelta,
    reliabilityDelta,
    avgSuccessRate,
    avgRuntime,
    computeRoute,
    rowCount: n,
  }
}
