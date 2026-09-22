/**
 * lib/finance/run.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Orchestrates a single finance-twin run: always computes the classical
 * baseline first, then optionally the experimental/quantum-inspired route,
 * and assembles the full FinanceRunResult envelope (lineage, timings,
 * honesty flags). This is the only place that decides `status` /
 * `executionMode` / `capability` — modules never fabricate these themselves.
 */
import { randomUUID } from "node:crypto"
import type {
  ExecutionMode,
  FinanceModuleDefinition,
  FinanceModuleId,
  FinanceRunResult,
  LineageEntry,
  TimingBreakdownMs,
} from "@/lib/finance/types"

export interface ExecuteFinanceRunParams<TSnapshot, TScenario> {
  moduleId: FinanceModuleId
  moduleDef: FinanceModuleDefinition<TSnapshot, TScenario, any, any>
  snapshot: TSnapshot
  scenario: TScenario
  seed: number
  isSynthetic: boolean
  snapshotId: string
  snapshotHash: string
  twinId: string
  modelVersion: string
  requestExperimental: boolean
}

function zeroTimings(): TimingBreakdownMs {
  // No real queueing/warmup/transfer stage exists in this single-process pilot —
  // reported as 0 rather than fabricated, per the no-invented-numbers rule.
  return { prepare: 0, warmup: 0, execute: 0, queue: 0, transfer: 0, postprocess: 0 }
}

export function executeFinanceRun<TSnapshot, TScenario>(
  params: ExecuteFinanceRunParams<TSnapshot, TScenario>,
): FinanceRunResult<unknown, unknown> {
  const startedAt = new Date().toISOString()
  const runId = randomUUID()
  const timings = zeroTimings()

  const prepStart = Date.now()
  // (validation already happened via parseSnapshot/parseScenario before this call)
  timings.prepare = Date.now() - prepStart

  const execStart = Date.now()
  let baseline: ReturnType<FinanceModuleDefinition["runClassical"]>
  try {
    baseline = params.moduleDef.runClassical(params.snapshot, params.scenario, params.seed)
  } catch (err) {
    const completedAt = new Date().toISOString()
    return {
      runId,
      twinId: params.twinId,
      snapshotId: params.snapshotId,
      snapshotHash: params.snapshotHash,
      moduleId: params.moduleId,
      executionMode: "classical",
      solverActual: "none",
      status: "failed",
      isSynthetic: params.isSynthetic,
      seed: params.seed,
      modelVersion: params.modelVersion,
      calibrationStatus: params.isSynthetic ? "demo-calibrated" : "uncalibrated",
      dataSource: params.isSynthetic ? "synthetic-demo" : "user-supplied",
      lineage: [],
      timingsMs: timings,
      result: null,
      baseline: null,
      kpis: null,
      warnings: [err instanceof Error ? err.message : "Unknown error running classical baseline"],
      startedAt,
      completedAt,
    }
  }
  timings.execute = Date.now() - execStart

  let executionMode: ExecutionMode = "classical"
  let solverActual = baseline.solverActual
  let result: unknown = baseline.result
  let kpis: unknown = baseline.kpis
  let lineage: LineageEntry[] = baseline.lineage
  let warnings: string[] = [...baseline.warnings]
  let status: FinanceRunResult["status"] = "completed"
  let capability: FinanceRunResult["capability"]

  if (params.requestExperimental) {
    const expStart = Date.now()
    const experimental = params.moduleDef.runExperimental(params.snapshot, params.scenario, params.seed, {
      result: baseline.result,
      kpis: baseline.kpis,
    })
    timings.execute += Date.now() - expStart

    if ("available" in experimental && experimental.available === false) {
      status = "capability_unavailable"
      capability = experimental
      warnings.push(experimental.reason)
      // result/kpis stay as the classical baseline — never invented for the unavailable route.
    } else if ("available" in experimental) {
      executionMode = experimental.executionMode
      solverActual = experimental.solverActual
      result = experimental.result
      kpis = experimental.kpis
      lineage = [...lineage, ...experimental.lineage]
      warnings = [...warnings, ...experimental.warnings]
    }
  }

  const completedAt = new Date().toISOString()

  return {
    runId,
    twinId: params.twinId,
    snapshotId: params.snapshotId,
    snapshotHash: params.snapshotHash,
    moduleId: params.moduleId,
    executionMode,
    solverActual,
    status,
    isSynthetic: params.isSynthetic,
    seed: params.seed,
    modelVersion: params.modelVersion,
    calibrationStatus: params.isSynthetic ? "demo-calibrated" : "uncalibrated",
    dataSource: params.isSynthetic ? "synthetic-demo" : "user-supplied",
    lineage,
    timingsMs: timings,
    result,
    baseline: baseline.result,
    kpis,
    warnings,
    capability,
    startedAt,
    completedAt,
  }
}
