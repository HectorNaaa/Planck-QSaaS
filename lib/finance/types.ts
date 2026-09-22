/**
 * lib/finance/types.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared, domain-agnostic contract for Planck "finance digital twins".
 *
 * The core (registry, snapshot/versioning, execution bookkeeping) is generic —
 * it does not know anything about VaR, collateral or RFQs. Each concrete
 * module (lib/finance/modules/*) plugs into this contract and owns its own
 * input/output shapes.
 *
 * IMPORTANT (honesty contract):
 *  - `executionMode` / `solverActual` must reflect what really ran. Never
 *    silently fall back to a fake/simulated result while reporting a
 *    higher execution mode than what actually executed.
 *  - Any route that has no real implementation MUST return
 *    `{ available: false, reason }` via `CapabilityUnavailable` — inventing
 *    numbers to "complete" an interface is not allowed.
 *  - `isSynthetic` must be `true` for any demo/seeded dataset. It must never
 *    be presented as evidence of a real financial outcome.
 */

/** Distinguishes the actual compute route used, independent of public backend labels. */
export type ExecutionMode =
  | "classical"
  | "quantum-inspired"
  | "quantum-simulated"
  | "quantum-hardware"

export type FinanceModuleId =
  | "risk-scenario"
  | "collateral-liquidity"
  | "execution-rfq"

export interface CapabilityUnavailable {
  available: false
  reason: string
}

export interface FinanceSnapshotRecord<TData = unknown> {
  id: string
  twinId: string
  userId: string
  moduleId: FinanceModuleId
  version: number
  snapshotHash: string
  model: string | null
  constraints: Record<string, unknown> | null
  data: TData
  isSynthetic: boolean
  seed: number | null
  createdAt: string
}

/** One entry of the run's provenance/lineage trail. */
export interface LineageEntry {
  step: string
  detail: string
  at: string
}

export interface TimingBreakdownMs {
  prepare: number
  warmup: number
  execute: number
  queue: number
  transfer: number
  postprocess: number
}

export interface FinanceRunResult<TResult = unknown, TKpis = unknown> {
  runId: string
  twinId: string
  snapshotId: string
  snapshotHash: string
  moduleId: FinanceModuleId
  executionMode: ExecutionMode
  solverActual: string
  status: "completed" | "failed" | "capability_unavailable"
  isSynthetic: boolean
  seed: number | null
  modelVersion: string
  calibrationStatus: "uncalibrated" | "demo-calibrated" | "not-applicable"
  dataSource: string
  lineage: LineageEntry[]
  timingsMs: TimingBreakdownMs
  result: TResult | null
  baseline: TResult | null
  kpis: TKpis | null
  warnings: string[]
  capability?: CapabilityUnavailable
  startedAt: string
  completedAt: string
}

/** Generic module registration contract. `TSnapshot`/`TScenario` are module-owned. */
export interface FinanceModuleDefinition<TSnapshotInput = any, TScenario = any, TResult = any, TKpis = any> {
  id: FinanceModuleId
  name: string
  description: string
  clientProfile: string
  /** Validates + normalizes raw snapshot input. Throws on invalid input. */
  parseSnapshot: (raw: unknown) => TSnapshotInput
  /** Validates + normalizes raw scenario input. Throws on invalid input. */
  parseScenario: (raw: unknown) => TScenario
  /** Runs the classical baseline. Must be a real, verifiable calculation. */
  runClassical: (snapshot: TSnapshotInput, scenario: TScenario, seed: number) => {
    result: TResult
    kpis: TKpis
    solverActual: string
    lineage: LineageEntry[]
    warnings: string[]
  }
  /** Runs the experimental / quantum-inspired route, or reports unavailability. */
  runExperimental: (
    snapshot: TSnapshotInput,
    scenario: TScenario,
    seed: number,
    baseline: { result: TResult; kpis: TKpis },
  ) =>
    | {
        available: true
        result: TResult
        kpis: TKpis
        executionMode: ExecutionMode
        solverActual: string
        lineage: LineageEntry[]
        warnings: string[]
      }
    | CapabilityUnavailable
}
