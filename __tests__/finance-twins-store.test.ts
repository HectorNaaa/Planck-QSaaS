/**
 * __tests__/finance-twins-store.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Verifies twin persistence: private-by-default visibility, tenant isolation
 * (another user can never read/update/delete someone else's private twin),
 * publish/duplicate only ever copies the definition (never snapshots/runs),
 * and that ephemeral demo/ad-hoc twins never leak into "My Twins" listings.
 *
 * Uses an isolated temp SQLite file (via DB_DIR) — never touches the real
 * dev/prod database. Modules are imported dynamically inside beforeAll so
 * DB_DIR is set before lib/db/init.ts is first evaluated.
 */
import { describe, it, expect, beforeAll } from "vitest"
import os from "node:os"
import path from "node:path"
import fs from "node:fs"

let Users: any
let store: typeof import("@/lib/finance/store")
let ownerId: string
let otherUserId: string

beforeAll(async () => {
  const testDbDir = fs.mkdtempSync(path.join(os.tmpdir(), "planck-twins-test-"))
  process.env.DB_DIR = testDbDir

  const clientModule = await import("@/lib/db/client")
  store = await import("@/lib/finance/store")

  Users = clientModule.Users
  ownerId = Users.create(`owner-${Date.now()}@example.com`, "hash").id
  otherUserId = Users.create(`other-${Date.now()}@example.com`, "hash").id
})

describe("finance twin store — privacy & tenant isolation", () => {
  it("createUserTwin defaults to private and kind=user_defined", () => {
    const twin = store.createUserTwin({ userId: ownerId, moduleId: "risk-scenario", name: "My Risk Twin" })
    expect(twin.visibility).toBe("private")
    expect(twin.kind).toBe("user_defined")
    expect(twin.tags).toEqual(["finance"])
  })

  it("clamps unsupported tags down to the finance-only allow-list", () => {
    const twin = store.createUserTwin({
      userId: ownerId,
      moduleId: "risk-scenario",
      name: "Tagged Twin",
      tags: ["finance", "healthcare", "not-real"],
    })
    expect(twin.tags).toEqual(["finance"])
  })

  it("ephemeral (per-run demo) twins never show up in listUserTwins", () => {
    const before = store.listUserTwins(ownerId).length
    store.createTwin(ownerId, "risk-scenario", "Demo run twin")
    const after = store.listUserTwins(ownerId).length
    expect(after).toBe(before)
  })

  it("a private twin is invisible to other users via getReadableTwin/getOwnedTwin", () => {
    const twin = store.createUserTwin({ userId: ownerId, moduleId: "execution-rfq", name: "Private RFQ Twin" })
    expect(store.getOwnedTwin(twin.id, otherUserId)).toBeNull()
    expect(store.getReadableTwin(twin.id, otherUserId)).toBeNull()
    expect(store.getReadableTwin(twin.id, ownerId)).not.toBeNull()
  })

  it("other users cannot update, publish, or delete a twin they don't own", () => {
    const twin = store.createUserTwin({ userId: ownerId, moduleId: "collateral-liquidity", name: "Owner Only Twin" })
    expect(store.updateTwin(twin.id, otherUserId, { name: "hijacked" })).toBeNull()
    expect(store.setTwinVisibility(twin.id, otherUserId, "public")).toBeNull()
    expect(store.deleteTwin(twin.id, otherUserId)).toBe(false)

    // Untouched by the failed attempts:
    const stillOwners = store.getOwnedTwin(twin.id, ownerId)
    expect(stillOwners?.name).toBe("Owner Only Twin")
    expect(stillOwners?.visibility).toBe("private")
  })

  it("publishing exposes only the definition, never snapshots/results, and listPublicTwins never returns other users' private twins", () => {
    const privateOne = store.createUserTwin({ userId: ownerId, moduleId: "risk-scenario", name: "Stays Private" })
    const published = store.createUserTwin({
      userId: ownerId,
      moduleId: "risk-scenario",
      name: "Published Twin",
      description: "shared definition only",
      config: { scenario: { horizonDays: 5 } },
      visibility: "public",
    })

    const publicList = store.listPublicTwins("finance")
    const ids = publicList.map((t) => t.id)
    expect(ids).toContain(published.id)
    expect(ids).not.toContain(privateOne.id)

    const publicRecord = publicList.find((t) => t.id === published.id)!
    // Only definition fields exist on a TwinRecord — no snapshot/data/result keys at all.
    expect(Object.keys(publicRecord).sort()).toEqual(
      [
        "config",
        "createdAt",
        "description",
        "id",
        "kind",
        "moduleId",
        "name",
        "publishedAt",
        "sourceTwinId",
        "tags",
        "updatedAt",
        "userId",
        "visibility",
      ].sort(),
    )
  })

  it("duplicateTwin copies the definition into the caller's own private space without touching the source", () => {
    const source = store.createUserTwin({
      userId: ownerId,
      moduleId: "execution-rfq",
      name: "Community Source",
      config: { scenario: { lotSize: 500 } },
      visibility: "public",
    })

    const copy = store.duplicateTwin(source.id, otherUserId)
    expect(copy).not.toBeNull()
    expect(copy!.userId).toBe(otherUserId)
    expect(copy!.visibility).toBe("private")
    expect(copy!.sourceTwinId).toBe(source.id)
    expect(copy!.config).toEqual(source.config)

    // Source twin itself is untouched and still owned by the original owner.
    const sourceAfter = store.getOwnedTwin(source.id, ownerId)
    expect(sourceAfter?.name).toBe("Community Source")
  })

  it("duplicateTwin refuses to copy another user's private twin", () => {
    const priv = store.createUserTwin({ userId: ownerId, moduleId: "risk-scenario", name: "Not Shared" })
    expect(store.duplicateTwin(priv.id, otherUserId)).toBeNull()
  })

  it("setTwinVisibility toggles publish/unpublish and stamps/clears publishedAt", () => {
    const twin = store.createUserTwin({ userId: ownerId, moduleId: "risk-scenario", name: "Toggle Twin" })
    const published = store.setTwinVisibility(twin.id, ownerId, "public")
    expect(published?.visibility).toBe("public")
    expect(published?.publishedAt).not.toBeNull()

    const unpublished = store.setTwinVisibility(twin.id, ownerId, "private")
    expect(unpublished?.visibility).toBe("private")
    expect(unpublished?.publishedAt).toBeNull()
  })
})
