/**
 * lib/finance/store.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Persistence for finance twins/snapshots/runs. All reads are scoped by
 * `userId` (tenant isolation) — there is no cross-tenant query in this file.
 */
import db from "@/lib/db/init"
import { randomUUID } from "node:crypto"
import type { FinanceModuleId, FinanceRunResult, LineageEntry } from "@/lib/finance/types"

export function createTwin(userId: string, moduleId: FinanceModuleId, name: string): string {
  const id = randomUUID()
  db.prepare("INSERT INTO finance_twins (id, user_id, module_id, name) VALUES (?, ?, ?, ?)").run(id, userId, moduleId, name)
  return id
}

export function createSnapshot(params: {
  userId: string
  twinId: string
  moduleId: FinanceModuleId
  snapshotHash: string
  model: string | null
  constraints: Record<string, unknown> | null
  data: unknown
  isSynthetic: boolean
  seed: number | null
}): string {
  const id = randomUUID()
  const versionRow = db
    .prepare("SELECT COALESCE(MAX(version), 0) as v FROM finance_snapshots WHERE twin_id = ?")
    .get(params.twinId) as any
  const version = (versionRow?.v ?? 0) + 1
  db.prepare(
    `INSERT INTO finance_snapshots
      (id, twin_id, user_id, module_id, version, snapshot_hash, model, constraints, data, is_synthetic, seed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    params.twinId,
    params.userId,
    params.moduleId,
    version,
    params.snapshotHash,
    params.model,
    params.constraints ? JSON.stringify(params.constraints) : null,
    JSON.stringify(params.data),
    params.isSynthetic ? 1 : 0,
    params.seed,
  )
  return id
}

export function findSnapshotByUser(snapshotId: string, userId: string): any {
  return db.prepare("SELECT * FROM finance_snapshots WHERE id = ? AND user_id = ?").get(snapshotId, userId)
}

export function saveRun(params: {
  userId: string
  executionId: string | null
  snapshotId: string
  moduleId: FinanceModuleId
  run: FinanceRunResult<unknown, unknown>
}): string {
  const id = randomUUID()
  db.prepare(
    `INSERT INTO finance_runs
      (id, execution_id, snapshot_id, user_id, module_id, execution_mode, solver_actual, status,
       is_synthetic, seed, model_version, calibration_status, lineage, result, kpis, baseline, warnings,
       started_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    params.executionId,
    params.snapshotId,
    params.userId,
    params.moduleId,
    params.run.executionMode,
    params.run.solverActual,
    params.run.status,
    params.run.isSynthetic ? 1 : 0,
    params.run.seed,
    params.run.modelVersion,
    params.run.calibrationStatus,
    JSON.stringify(params.run.lineage satisfies LineageEntry[]),
    JSON.stringify(params.run.result),
    JSON.stringify(params.run.kpis),
    JSON.stringify(params.run.baseline),
    JSON.stringify(params.run.warnings),
    params.run.startedAt,
    params.run.completedAt,
  )
  return id
}

/** Tenant-isolated: only ever returns rows owned by `userId`. */
export function listRunsForUser(userId: string, moduleId?: FinanceModuleId, limit = 50) {
  if (moduleId) {
    return db
      .prepare("SELECT * FROM finance_runs WHERE user_id = ? AND module_id = ? ORDER BY created_at DESC LIMIT ?")
      .all(userId, moduleId, limit)
  }
  return db.prepare("SELECT * FROM finance_runs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?").all(userId, limit)
}
