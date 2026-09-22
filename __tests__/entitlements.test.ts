/**
 * __tests__/entitlements.test.ts
 * Verifies the real server-side quota gate (lib/entitlements.ts) — atomic
 * reservation, commit, release, and that quota can never be exceeded even
 * across many rapid "concurrent-looking" requests for the same user.
 *
 * Uses an isolated temp SQLite file (via DB_DIR) so this never touches the
 * real dev/prod database.
 */
import { describe, it, expect, beforeAll } from "vitest"
import os from "node:os"
import path from "node:path"
import fs from "node:fs"

const testDbDir = fs.mkdtempSync(path.join(os.tmpdir(), "planck-entitlements-test-"))
process.env.DB_DIR = testDbDir

const dbModule = await import("@/lib/db/init")
const { Users } = await import("@/lib/db/client")
const {
  reserveQuota,
  commitReservation,
  releaseReservation,
  QuotaExceededError,
  getPlanLimits,
} = await import("@/lib/entitlements")

const db = dbModule.default

describe("entitlements — atomic quota reservation", () => {
  let userId: string

  beforeAll(() => {
    const user = Users.create(`test-${Date.now()}@example.com`, "hash")
    userId = user.id
    // Seed a tiny dedicated plan so the test doesn't depend on production defaults.
    db.prepare(
      `INSERT OR REPLACE INTO plan_limits
        (plan, max_executions_per_cycle, max_concurrent_jobs, max_compute_ms_per_cycle, max_storage_bytes, cycle_length_days)
       VALUES ('test-tiny', 3, 1, 100000, 1000000, 30)`,
    ).run()
    db.prepare("INSERT INTO entitlements (user_id, plan) VALUES (?, 'test-tiny')").run(userId)
  })

  it("getPlanLimits reflects the seeded tiny plan", () => {
    const limits = getPlanLimits("test-tiny")
    expect(limits.maxExecutionsPerCycle).toBe(3)
  })

  it("allows reservations up to the limit and rejects the one that would exceed it", () => {
    const r1 = reserveQuota(userId, "execution", 1)
    const r2 = reserveQuota(userId, "execution", 1)
    const r3 = reserveQuota(userId, "execution", 1)
    expect([r1, r2, r3].every((id) => typeof id === "string")).toBe(true)

    expect(() => reserveQuota(userId, "execution", 1)).toThrow(QuotaExceededError)

    // cleanup for subsequent tests
    releaseReservation(r1)
    releaseReservation(r2)
    releaseReservation(r3)
  })

  it("never allows more than the limit across many rapid sequential reservation attempts", () => {
    const limit = 3
    const accepted: string[] = []
    let rejected = 0
    for (let i = 0; i < 20; i++) {
      try {
        accepted.push(reserveQuota(userId, "execution", 1))
      } catch (err) {
        if (err instanceof QuotaExceededError) rejected++
        else throw err
      }
    }
    expect(accepted.length).toBe(limit)
    expect(rejected).toBe(20 - limit)
    for (const id of accepted) releaseReservation(id)
  })

  it("commit folds the reservation into the used counter permanently (release does not undo a commit)", () => {
    const r = reserveQuota(userId, "execution", 1)
    commitReservation(r)
    const entitlement = db.prepare("SELECT * FROM entitlements WHERE user_id = ?").get(userId) as any
    expect(entitlement.executions_used).toBeGreaterThanOrEqual(1)

    // Releasing an already-committed reservation is a safe no-op (idempotent), not a refund.
    releaseReservation(r)
    const after = db.prepare("SELECT * FROM entitlements WHERE user_id = ?").get(userId) as any
    expect(after.executions_used).toBe(entitlement.executions_used)
  })

  it("falls back to the default plan when an unknown plan is requested", () => {
    expect(() => getPlanLimits("ghost-plan")).not.toThrow() // falls back to 'starter' (seeded by migrations)
    expect(getPlanLimits("ghost-plan").plan).toBe("starter")
  })

  it("fails closed (throws) when neither the plan nor the default fallback exist", () => {
    db.prepare("DELETE FROM plan_limits WHERE plan IN ('starter', 'totally-unknown-plan')").run()
    expect(() => getPlanLimits("totally-unknown-plan")).toThrow()
  })
})
