/**
 * lib/finance/store.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Persistence for finance twins/snapshots/runs. All reads are scoped by
 * `userId` (tenant isolation) — there is no cross-tenant query in this file.
 */
import db from "@/lib/db/init"
import { randomUUID } from "node:crypto"
import type { FinanceModuleId, FinanceRunResult, LineageEntry } from "@/lib/finance/types"

/** Only "finance" is supported today; the schema is deliberately open for future verticals. */
export const ALLOWED_TWIN_TAGS = ["finance"] as const
export type TwinVisibility = "private" | "public"

export interface TwinRecord {
  id: string
  userId: string
  moduleId: FinanceModuleId
  name: string
  description: string | null
  tags: string[]
  config: Record<string, unknown> | null
  visibility: TwinVisibility
  kind: "ephemeral" | "user_defined"
  sourceTwinId: string | null
  createdAt: string
  updatedAt: string | null
  publishedAt: string | null
}

function rowToTwin(row: any): TwinRecord {
  return {
    id: row.id,
    userId: row.user_id,
    moduleId: row.module_id,
    name: row.name,
    description: row.description ?? null,
    tags: row.tags ? safeJsonParse(row.tags, ["finance"]) : ["finance"],
    config: row.config ? safeJsonParse(row.config, null) : null,
    visibility: row.visibility === "public" ? "public" : "private",
    kind: row.kind === "user_defined" ? "user_defined" : "ephemeral",
    sourceTwinId: row.source_twin_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
    publishedAt: row.published_at ?? null,
  }
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** Clamps caller-supplied tags to the currently supported set (finance-only for now). */
export function sanitizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return ["finance"]
  const clamped = raw
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => (ALLOWED_TWIN_TAGS as readonly string[]).includes(t))
  return clamped.length > 0 ? Array.from(new Set(clamped)) : ["finance"]
}

/** Ephemeral, throwaway twin created for a single ad-hoc/demo run (legacy path — unchanged). */
export function createTwin(userId: string, moduleId: FinanceModuleId, name: string): string {
  const id = randomUUID()
  db.prepare(
    "INSERT INTO finance_twins (id, user_id, module_id, name, kind, visibility, tags) VALUES (?, ?, ?, ?, 'ephemeral', 'private', '[\"finance\"]')",
  ).run(id, userId, moduleId, name)
  return id
}

/** Explicit "Create my twin" — a saved, reusable, re-runnable instance. Private by default. */
export function createUserTwin(params: {
  userId: string
  moduleId: FinanceModuleId
  name: string
  description?: string | null
  tags?: string[]
  config?: Record<string, unknown> | null
  visibility?: TwinVisibility
  sourceTwinId?: string | null
}): TwinRecord {
  const id = randomUUID()
  const tags = sanitizeTags(params.tags)
  const visibility: TwinVisibility = params.visibility === "public" ? "public" : "private"
  db.prepare(
    `INSERT INTO finance_twins (id, user_id, module_id, name, description, tags, config, visibility, kind, published_at, source_twin_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'user_defined', ?, ?)`,
  ).run(
    id,
    params.userId,
    params.moduleId,
    params.name,
    params.description ?? null,
    JSON.stringify(tags),
    params.config ? JSON.stringify(params.config) : null,
    visibility,
    visibility === "public" ? new Date().toISOString() : null,
    params.sourceTwinId ?? null,
  )
  return getTwinById(id)!
}

export function getTwinById(id: string): TwinRecord | null {
  const row = db.prepare("SELECT * FROM finance_twins WHERE id = ?").get(id)
  return row ? rowToTwin(row) : null
}

/** Tenant-isolated: only returns the twin when owned by `userId`. */
export function getOwnedTwin(id: string, userId: string): TwinRecord | null {
  const row = db.prepare("SELECT * FROM finance_twins WHERE id = ? AND user_id = ?").get(id, userId)
  return row ? rowToTwin(row) : null
}

/** A twin is runnable/readable by `userId` if they own it, or it's published publicly. */
export function getReadableTwin(id: string, userId: string): TwinRecord | null {
  const t = getTwinById(id)
  if (!t) return null
  if (t.userId === userId || t.visibility === "public") return t
  return null
}

/** This user's own saved twins (never includes ephemeral demo/trial runs). */
export function listUserTwins(userId: string): TwinRecord[] {
  const rows = db
    .prepare("SELECT * FROM finance_twins WHERE user_id = ? AND kind = 'user_defined' ORDER BY created_at DESC")
    .all(userId)
  return (rows as any[]).map(rowToTwin)
}

/** Community-published twins, optionally filtered by tag. Never exposes other users' private twins. */
export function listPublicTwins(tag?: string): TwinRecord[] {
  const rows = tag
    ? db
        .prepare(
          "SELECT * FROM finance_twins WHERE kind = 'user_defined' AND visibility = 'public' AND tags LIKE ? ORDER BY published_at DESC",
        )
        .all(`%"${tag}"%`)
    : db
        .prepare("SELECT * FROM finance_twins WHERE kind = 'user_defined' AND visibility = 'public' ORDER BY published_at DESC")
        .all()
  return (rows as any[]).map(rowToTwin)
}

export function updateTwin(
  id: string,
  userId: string,
  patch: { name?: string; description?: string | null; tags?: string[]; config?: Record<string, unknown> | null },
): TwinRecord | null {
  const existing = getOwnedTwin(id, userId)
  if (!existing || existing.kind !== "user_defined") return null
  const name = patch.name ?? existing.name
  const description = patch.description !== undefined ? patch.description : existing.description
  const tags = patch.tags ? sanitizeTags(patch.tags) : existing.tags
  const config = patch.config !== undefined ? patch.config : existing.config
  db.prepare(
    "UPDATE finance_twins SET name = ?, description = ?, tags = ?, config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
  ).run(name, description, JSON.stringify(tags), config ? JSON.stringify(config) : null, id, userId)
  return getTwinById(id)
}

/**
 * Publish/unpublish the twin's current *definition* (name/description/tags/config only).
 * Never touches snapshots/results — those stay tied to `finance_snapshots`/`finance_runs`
 * and are never made visible to other users.
 */
export function setTwinVisibility(id: string, userId: string, visibility: TwinVisibility): TwinRecord | null {
  const existing = getOwnedTwin(id, userId)
  if (!existing || existing.kind !== "user_defined") return null
  db.prepare(
    "UPDATE finance_twins SET visibility = ?, published_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
  ).run(visibility, visibility === "public" ? new Date().toISOString() : null, id, userId)
  return getTwinById(id)
}

/** Copies a public twin's definition into the caller's private space. Never copies data/snapshots/runs. */
export function duplicateTwin(sourceId: string, callerUserId: string): TwinRecord | null {
  const source = getTwinById(sourceId)
  if (!source || source.kind !== "user_defined" || (source.visibility !== "public" && source.userId !== callerUserId)) {
    return null
  }
  return createUserTwin({
    userId: callerUserId,
    moduleId: source.moduleId,
    name: `${source.name} (copy)`,
    description: source.description,
    tags: source.tags,
    config: source.config,
    visibility: "private",
    sourceTwinId: source.id,
  })
}

export function deleteTwin(id: string, userId: string): boolean {
  const result = db.prepare("DELETE FROM finance_twins WHERE id = ? AND user_id = ? AND kind = 'user_defined'").run(id, userId)
  return result.changes > 0
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
