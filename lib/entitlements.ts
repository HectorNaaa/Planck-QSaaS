/**
 * lib/entitlements.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-side plan entitlements + quota gate.
 *
 * Hard rules (do not weaken these):
 *  - Plan, quota, role and identity are NEVER read from the request body,
 *    headers, cookies content, or localStorage — only from this module's own
 *    DB-backed lookup keyed by the authenticated `userId`.
 *  - Quota is reserved BEFORE the costly work runs (reserveQuota), then
 *    either committed (commitReservation) on success or released
 *    (releaseReservation) on failure/cancel. Abandoned reservations expire
 *    automatically (sweepAbandonedReservations) so a crashed job cannot leak
 *    quota forever.
 *  - Fail CLOSED: if the DB lookup needed to grant quota throws for any
 *    reason, the request is denied. Never "allow and continue" on error.
 *  - Reservation math runs inside a single better-sqlite3 transaction
 *    (synchronous, no `await` in between check and insert) so concurrent
 *    requests handled by the same Node process cannot race past the limit.
 */
import db from "@/lib/db/init"
import { randomUUID } from "node:crypto"

export type ResourceType = "execution" | "compute_ms" | "storage_bytes"

export class QuotaExceededError extends Error {
  constructor(
    public resourceType: ResourceType,
    public limit: number,
    public used: number,
    public plan: string,
  ) {
    super(`Quota exceeded for ${resourceType}: ${used}/${limit} on plan ${plan}`)
    this.name = "QuotaExceededError"
  }
}

export interface PlanLimits {
  plan: string
  maxExecutionsPerCycle: number
  maxConcurrentJobs: number
  maxComputeMsPerCycle: number
  maxStorageBytes: number
  cycleLengthDays: number
}

const RESERVATION_TTL_MS = 5 * 60 * 1000 // abandoned-reservation sweep window
const DEFAULT_PLAN = "starter"

function rowToPlanLimits(row: any): PlanLimits {
  return {
    plan: row.plan,
    maxExecutionsPerCycle: row.max_executions_per_cycle,
    maxConcurrentJobs: row.max_concurrent_jobs,
    maxComputeMsPerCycle: row.max_compute_ms_per_cycle,
    maxStorageBytes: row.max_storage_bytes,
    cycleLengthDays: row.cycle_length_days,
  }
}

/** Reads the authoritative, editable plan_limits row. Throws (fails closed) if the plan is unknown and no fallback exists. */
export function getPlanLimits(plan: string): PlanLimits {
  const row = db.prepare("SELECT * FROM plan_limits WHERE plan = ?").get(plan)
  if (row) return rowToPlanLimits(row)
  const fallback = db.prepare("SELECT * FROM plan_limits WHERE plan = ?").get(DEFAULT_PLAN)
  if (fallback) return rowToPlanLimits(fallback)
  throw new Error(`No plan_limits configured for plan="${plan}" and no default fallback exists`)
}

function limitFor(resourceType: ResourceType, limits: PlanLimits): number {
  switch (resourceType) {
    case "execution": return limits.maxExecutionsPerCycle
    case "compute_ms": return limits.maxComputeMsPerCycle
    case "storage_bytes": return limits.maxStorageBytes
  }
}

function usedColumnFor(resourceType: ResourceType): string {
  switch (resourceType) {
    case "execution": return "executions_used"
    case "compute_ms": return "compute_ms_used"
    case "storage_bytes": return "storage_bytes_used"
  }
}

/** Ensures an entitlements row exists for `userId`, rolling the cycle if it has expired. Never trusts client input. */
function ensureEntitlementRow(userId: string): { plan: string; cycleStart: string } {
  const existing = db.prepare("SELECT * FROM entitlements WHERE user_id = ?").get(userId) as any
  if (!existing) {
    db.prepare(
      "INSERT INTO entitlements (user_id, plan, cycle_start) VALUES (?, ?, CURRENT_TIMESTAMP)",
    ).run(userId, DEFAULT_PLAN)
    return { plan: DEFAULT_PLAN, cycleStart: new Date().toISOString() }
  }
  const limits = getPlanLimits(existing.plan)
  const cycleStart = new Date(existing.cycle_start)
  const cycleMs = limits.cycleLengthDays * 24 * 60 * 60 * 1000
  if (Date.now() - cycleStart.getTime() > cycleMs) {
    db.prepare(
      "UPDATE entitlements SET cycle_start = CURRENT_TIMESTAMP, executions_used = 0, compute_ms_used = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
    ).run(userId)
    // storage_bytes_used is NOT reset on cycle roll — storage is a standing footprint, not a per-cycle allowance.
    return { plan: existing.plan, cycleStart: new Date().toISOString() }
  }
  return { plan: existing.plan, cycleStart: existing.cycle_start }
}

/** Frees reservations whose TTL has elapsed without being committed or released. */
function sweepAbandonedReservationsInternal(): void {
  db.prepare(
    "UPDATE quota_reservations SET status = 'expired' WHERE status = 'reserved' AND expires_at < CURRENT_TIMESTAMP",
  ).run()
}

export function sweepAbandonedReservations(): void {
  sweepAbandonedReservationsInternal()
}

function activeReservedSum(userId: string, resourceType: ResourceType): number {
  const row = db
    .prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM quota_reservations WHERE user_id = ? AND resource_type = ? AND status = 'reserved'",
    )
    .get(userId, resourceType) as any
  return row?.total ?? 0
}

/**
 * Runs `fn` wrapped in an explicit BEGIN IMMEDIATE / COMMIT (manual SQL
 * transaction) rather than better-sqlite3's `Database#transaction()` helper.
 * `.transaction()` is avoided deliberately: it was the only call site in this
 * codebase to use it, and it reproducibly crashed the whole Node process
 * with a native SIGABRT (node::RemoveEnvironmentCleanupHook assertion) on
 * Vercel's serverless runtime, while never reproducing locally. Plain
 * `db.prepare(...).run()/.get()` calls (used everywhere else) are unaffected.
 * This gives the same atomicity guarantee (single synchronous block, one
 * SQL-level transaction) without the suspect wrapper.
 */
function withTransaction<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE")
  try {
    const result = fn()
    db.exec("COMMIT")
    return result
  } catch (err) {
    try { db.exec("ROLLBACK") } catch { /* no active transaction to roll back */ }
    throw err
  }
}

/**
 * Atomically reserves `amount` of `resourceType` for `userId`, or throws
 * QuotaExceededError. Runs as a single synchronous better-sqlite3
 * transaction — no `await` occurs between the usage check and the insert,
 * so concurrent Node requests cannot both pass the check for the last unit
 * of quota.
 */
export function reserveQuota(userId: string, resourceType: ResourceType, amount: number): string {
  return withTransaction(() => {
    sweepAbandonedReservationsInternal()
    const { plan } = ensureEntitlementRow(userId)
    const limits = getPlanLimits(plan)
    const limit = limitFor(resourceType, limits)

    const entitlement = db.prepare("SELECT * FROM entitlements WHERE user_id = ?").get(userId) as any
    const used = entitlement[usedColumnFor(resourceType)] ?? 0
    const reserved = activeReservedSum(userId, resourceType)
    const projected = used + reserved + amount

    if (projected > limit) {
      throw new QuotaExceededError(resourceType, limit, used + reserved, plan)
    }

    const id = randomUUID()
    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS).toISOString()
    db.prepare(
      "INSERT INTO quota_reservations (id, user_id, resource_type, amount, status, expires_at) VALUES (?, ?, ?, ?, 'reserved', ?)",
    ).run(id, userId, resourceType, amount, expiresAt)
    return id
  })
}

/** Marks a reservation as committed and folds its amount into the cycle's used counter. */
export function commitReservation(reservationId: string): void {
  withTransaction(() => {
    const res = db.prepare("SELECT * FROM quota_reservations WHERE id = ?").get(reservationId) as any
    if (!res || res.status !== "reserved") return // already settled/expired — idempotent no-op
    db.prepare("UPDATE quota_reservations SET status = 'committed' WHERE id = ?").run(reservationId)
    const column = usedColumnFor(res.resource_type as ResourceType)
    db.prepare(
      `UPDATE entitlements SET ${column} = ${column} + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
    ).run(res.amount, res.user_id)
  })
}

/** Releases a reservation without charging usage (failed/cancelled job). Idempotent. */
export function releaseReservation(reservationId: string): void {
  withTransaction(() => {
    const res = db.prepare("SELECT * FROM quota_reservations WHERE id = ?").get(reservationId) as any
    if (!res || res.status !== "reserved") return
    db.prepare("UPDATE quota_reservations SET status = 'released' WHERE id = ?").run(reservationId)
  })
}

export function getEntitlementSummary(userId: string) {
  const { plan } = ensureEntitlementRow(userId)
  const limits = getPlanLimits(plan)
  const entitlement = db.prepare("SELECT * FROM entitlements WHERE user_id = ?").get(userId) as any
  return {
    plan,
    limits,
    used: {
      executions: entitlement.executions_used + activeReservedSum(userId, "execution"),
      computeMs: entitlement.compute_ms_used + activeReservedSum(userId, "compute_ms"),
      storageBytes: entitlement.storage_bytes_used,
    },
  }
}
