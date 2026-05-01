"use client"

/**
 * components/runner/scenario-comparison.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Compact "Scenario Comparison" card rendered in the Twin Simulator results
 * view after a run (or batch) completes.
 *
 * Reuses the same baseline-vs-latest logic from the dashboard via the shared
 * helper in lib/utils/scenario-comparison.ts.
 *
 * Shows when: rows contains at least 2 completed/saved executions.
 */

import { useMemo } from "react"
import { BarChart3 } from "lucide-react"
import { Card } from "@/components/ui/card"
import type { ExecutionRow } from "@/hooks/use-live-executions"
import {
  computeScenarioComparison,
  routeLabel,
} from "@/lib/utils/scenario-comparison"

interface ScenarioComparisonProps {
  rows: ExecutionRow[]
}

export function ScenarioComparison({ rows }: ScenarioComparisonProps) {
  const data = useMemo(() => computeScenarioComparison(rows), [rows])

  if (!data) return null

  const {
    baseline,
    latest,
    runtimeDelta,
    reliabilityDelta,
    avgSuccessRate,
    avgRuntime,
    computeRoute,
    rowCount,
  } = data

  const runtimeUp = runtimeDelta !== null && Number(runtimeDelta) > 0
  const reliabilityUp = reliabilityDelta !== null && Number(reliabilityDelta) > 0

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 size={14} className="text-primary" />
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Scenario Comparison
        </h3>
        <span className="ml-auto text-[11px] text-muted-foreground">{rowCount} runs</span>
      </div>

      {/* Three delta cards — mirrors dashboard layout */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Best Scenario */}
        <Card className="p-4 shadow border border-border bg-secondary/30">
          <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">
            Best Scenario
          </p>
          <p className="text-sm font-semibold text-foreground truncate">
            {latest.circuit_name || latest.algorithm || "Latest simulation"}
          </p>
          <p className="text-2xl font-bold text-primary mt-1">
            {latest.success_rate?.toFixed(1) ?? "—"}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            reliability · {routeLabel(latest.backend_selected)}
          </p>
        </Card>

        {/* Simulation Time Δ */}
        <Card className="p-4 shadow border border-border bg-secondary/30">
          <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">
            Simulation Time Δ
          </p>
          <p
            className="text-2xl font-bold mt-1"
            style={{ color: runtimeUp ? "#e07b54" : "#578e7e" }}
          >
            {runtimeDelta
              ? `${runtimeUp ? "+" : ""}${runtimeDelta}%`
              : "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {baseline.runtime_ms ?? "—"}ms → {latest.runtime_ms ?? "—"}ms
          </p>
          <p className="text-xs text-muted-foreground">baseline → latest</p>
        </Card>

        {/* Reliability Δ */}
        <Card className="p-4 shadow border border-border bg-secondary/30">
          <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">
            Reliability Δ
          </p>
          <p
            className="text-2xl font-bold mt-1"
            style={{ color: reliabilityUp ? "#578e7e" : "#e07b54" }}
          >
            {reliabilityDelta
              ? `${reliabilityUp ? "+" : ""}${reliabilityDelta}pp`
              : "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {baseline.success_rate?.toFixed(1) ?? "—"}% → {latest.success_rate?.toFixed(1) ?? "—"}%
          </p>
          <p className="text-xs text-muted-foreground">baseline → latest</p>
        </Card>
      </div>

      {/* Avg metrics summary strip */}
      <div className="grid grid-cols-3 gap-3 mt-3">
        <div className="p-3 bg-secondary/40 rounded-lg text-center border border-border">
          <p className="text-[10px] text-muted-foreground mb-0.5">Avg Reliability</p>
          <p className="text-sm font-bold text-foreground">{avgSuccessRate.toFixed(1)}%</p>
        </div>
        <div className="p-3 bg-secondary/40 rounded-lg text-center border border-border">
          <p className="text-[10px] text-muted-foreground mb-0.5">Avg Runtime</p>
          <p className="text-sm font-bold text-foreground">{Math.round(avgRuntime)}ms</p>
        </div>
        <div className="p-3 bg-secondary/40 rounded-lg text-center border border-border">
          <p className="text-[10px] text-muted-foreground mb-0.5">Compute Route</p>
          <p className="text-sm font-bold text-foreground">{routeLabel(computeRoute)}</p>
        </div>
      </div>
    </div>
  )
}
