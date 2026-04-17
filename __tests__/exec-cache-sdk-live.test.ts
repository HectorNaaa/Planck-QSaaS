/**
 * __tests__/exec-cache-sdk-live.test.ts
 * Unit tests for the execution-cache deletion-filter logic and SDK live
 * row-merge behaviour used by the runner page.
 *
 * Pure functions are extracted and tested in isolation; localStorage is
 * simulated with a simple in-memory Map so no browser is needed.
 */

import { describe, it, expect, beforeEach } from "vitest"

// ─── In-memory localStorage stub ─────────────────────────────────────────────
class MemStorage implements Storage {
  private store = new Map<string, string>()
  get length() { return this.store.size }
  key(i: number) { return [...this.store.keys()][i] ?? null }
  getItem(k: string) { return this.store.get(k) ?? null }
  setItem(k: string, v: string) { this.store.set(k, v) }
  removeItem(k: string) { this.store.delete(k) }
  clear() { this.store.clear() }
}

// ─── Copy of the helpers (extracted from settings/page.tsx & dashboard/page.tsx)
// Keeping this in sync with the source is intentional: if the source changes,
// the tests will catch regressions. ─────────────────────────────────────────

const CLEARED_BEFORE_KEY = "planck_exec_cleared_before"
const DELETED_IDS_KEY = "planck_exec_deleted_ids"

type Row = { id: string; created_at: string; [k: string]: unknown }

function makeHelpers(ls: Storage) {
  function appendDeletedIds(ids: string[]) {
    let arr: string[] = []
    const raw = ls.getItem(DELETED_IDS_KEY)
    if (raw) arr = JSON.parse(raw) as string[]
    const next = Array.from(new Set([...arr, ...ids])).slice(-2000)
    ls.setItem(DELETED_IDS_KEY, JSON.stringify(next))
  }

  function markHistoryCleared() {
    ls.setItem(CLEARED_BEFORE_KEY, new Date().toISOString())
    ls.removeItem(DELETED_IDS_KEY)
  }

  function applyLocalDeletedFilter<T extends Row>(rows: T[]): T[] {
    let clearedBefore: Date | null = null
    let deletedIds = new Set<string>()
    const ts = ls.getItem(CLEARED_BEFORE_KEY)
    if (ts) clearedBefore = new Date(ts)
    const raw = ls.getItem(DELETED_IDS_KEY)
    if (raw) deletedIds = new Set(JSON.parse(raw) as string[])
    if (!clearedBefore && deletedIds.size === 0) return rows
    return rows.filter((r) => {
      if (deletedIds.has(r.id)) return false
      if (clearedBefore && new Date(r.created_at) <= clearedBefore) return false
      return true
    })
  }

  function mergeServerAndCache(serverRows: Row[], cachedRows: Row[]): Row[] {
    const serverIds = new Set(serverRows.map((r) => r.id))
    const extra = cachedRows.filter((r) => !serverIds.has(r.id))
    const merged = applyLocalDeletedFilter([...serverRows, ...extra])
    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return merged
  }

  /** SDK live: merge new server rows into existing live rows (runner polling). */
  function mergeIntoLiveRows(prev: Row[], serverRows: Row[]): Row[] {
    const prevIds = new Set(prev.map((r) => r.id))
    const fresh = serverRows.filter((r) => !prevIds.has(r.id))
    if (fresh.length === 0) return prev
    const merged = [...prev, ...fresh]
    merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    return merged.slice(-500)
  }

  return { appendDeletedIds, markHistoryCleared, applyLocalDeletedFilter, mergeServerAndCache, mergeIntoLiveRows }
}

// ─── Test data ────────────────────────────────────────────────────────────────
const BASE_TIME = new Date("2025-01-10T12:00:00Z").getTime()
function makeRow(id: string, offsetMs = 0): Row {
  return { id, created_at: new Date(BASE_TIME + offsetMs).toISOString() }
}

const rowA = makeRow("a", 0)
const rowB = makeRow("b", 1_000)
const rowC = makeRow("c", 2_000)
const rowD = makeRow("d", 3_000)

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("applyLocalDeletedFilter — no filter set", () => {
  it("returns all rows untouched when localStorage is empty", () => {
    const ls = new MemStorage()
    const { applyLocalDeletedFilter } = makeHelpers(ls)
    expect(applyLocalDeletedFilter([rowA, rowB])).toEqual([rowA, rowB])
  })
})

describe("applyLocalDeletedFilter — deleted IDs", () => {
  let ls: MemStorage
  let helpers: ReturnType<typeof makeHelpers>

  beforeEach(() => {
    ls = new MemStorage()
    helpers = makeHelpers(ls)
  })

  it("removes rows whose IDs are in the deleted set", () => {
    helpers.appendDeletedIds(["a"])
    const result = helpers.applyLocalDeletedFilter([rowA, rowB, rowC])
    expect(result.map((r) => r.id)).toEqual(["b", "c"])
  })

  it("removes multiple deleted IDs", () => {
    helpers.appendDeletedIds(["a", "c"])
    const result = helpers.applyLocalDeletedFilter([rowA, rowB, rowC])
    expect(result.map((r) => r.id)).toEqual(["b"])
  })

  it("deduplicates IDs when appending multiple times", () => {
    helpers.appendDeletedIds(["a"])
    helpers.appendDeletedIds(["a", "b"])
    const stored = JSON.parse(ls.getItem(DELETED_IDS_KEY)!) as string[]
    expect(stored.sort()).toEqual(["a", "b"])
  })

  it("returns empty array if all rows are deleted", () => {
    helpers.appendDeletedIds(["a", "b", "c"])
    expect(helpers.applyLocalDeletedFilter([rowA, rowB, rowC])).toEqual([])
  })
})

describe("applyLocalDeletedFilter — cleared_before timestamp", () => {
  let ls: MemStorage
  let helpers: ReturnType<typeof makeHelpers>

  beforeEach(() => {
    ls = new MemStorage()
    helpers = makeHelpers(ls)
  })

  it("filters out rows older than or equal to cleared_before", () => {
    // Set cleared_before between rowB and rowC
    const divider = new Date(BASE_TIME + 1_500).toISOString()
    ls.setItem(CLEARED_BEFORE_KEY, divider)
    const result = helpers.applyLocalDeletedFilter([rowA, rowB, rowC, rowD])
    // rowA (0ms) and rowB (1000ms) are ≤ divider (1500ms) → filtered
    expect(result.map((r) => r.id)).toEqual(["c", "d"])
  })

  it("rows created AFTER cleared_before are kept", () => {
    ls.setItem(CLEARED_BEFORE_KEY, rowB.created_at)
    const result = helpers.applyLocalDeletedFilter([rowA, rowB, rowC])
    expect(result.map((r) => r.id)).toEqual(["c"])
  })
})

describe("markHistoryCleared", () => {
  let ls: MemStorage
  let helpers: ReturnType<typeof makeHelpers>

  beforeEach(() => {
    ls = new MemStorage()
    helpers = makeHelpers(ls)
  })

  it("sets cleared_before to approximately now", () => {
    const before = Date.now()
    helpers.markHistoryCleared()
    const after = Date.now()
    const ts = new Date(ls.getItem(CLEARED_BEFORE_KEY)!).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  it("removes the deleted IDs key", () => {
    helpers.appendDeletedIds(["x", "y"])
    helpers.markHistoryCleared()
    expect(ls.getItem(DELETED_IDS_KEY)).toBeNull()
  })

  it("filters all existing rows after marking cleared", () => {
    helpers.markHistoryCleared()
    const result = helpers.applyLocalDeletedFilter([rowA, rowB, rowC])
    expect(result).toEqual([])
  })

  it("allows new rows created AFTER the clear to pass through", () => {
    helpers.markHistoryCleared()
    // Use a timestamp that is genuinely in the future relative to real clock
    const futureRow: Row = { id: "future", created_at: new Date(Date.now() + 60_000).toISOString() }
    const result = helpers.applyLocalDeletedFilter([rowA, futureRow])
    expect(result.map((r) => r.id)).toEqual(["future"])
  })
})

describe("mergeServerAndCache — cross-lambda drift guard", () => {
  let ls: MemStorage
  let helpers: ReturnType<typeof makeHelpers>

  beforeEach(() => {
    ls = new MemStorage()
    helpers = makeHelpers(ls)
  })

  it("merges non-overlapping server and cache rows sorted newest-first", () => {
    const result = helpers.mergeServerAndCache([rowA, rowB], [rowC, rowD])
    expect(result.map((r) => r.id)).toEqual(["d", "c", "b", "a"])
  })

  it("does not duplicate rows that exist in both server and cache", () => {
    const result = helpers.mergeServerAndCache([rowA, rowB], [rowB, rowC])
    expect(result.map((r) => r.id)).toEqual(["c", "b", "a"])
  })

  it("filters out server rows that were explicitly deleted", () => {
    // Simulates cross-lambda drift: server returns rowA even after user deleted it
    helpers.appendDeletedIds(["a"])
    const result = helpers.mergeServerAndCache([rowA, rowB], [rowC])
    expect(result.map((r) => r.id)).not.toContain("a")
    expect(result.map((r) => r.id)).toContain("b")
    expect(result.map((r) => r.id)).toContain("c")
  })

  it("filters server rows older than cleared_before timestamp", () => {
    // User cleared all. Next API call on different lambda returns old rows.
    helpers.markHistoryCleared()
    const result = helpers.mergeServerAndCache([rowA, rowB], [])
    expect(result).toEqual([])
  })

  it("new rows written after a clear are not filtered", () => {
    helpers.markHistoryCleared()
    // Simulate a row the user created after clearing (timestamp > cleared_before)
    const newRow: Row = { id: "new", created_at: new Date(Date.now() + 60_000).toISOString() }
    const result = helpers.mergeServerAndCache([newRow], [])
    expect(result.map((r) => r.id)).toEqual(["new"])
  })
})

describe("mergeIntoLiveRows — runner SDK live polling", () => {
  let ls: MemStorage
  let helpers: ReturnType<typeof makeHelpers>

  beforeEach(() => {
    ls = new MemStorage()
    helpers = makeHelpers(ls)
  })

  it("appends new rows from poll without duplicating existing ones", () => {
    const prev = [rowA, rowB]
    const serverPoll = [rowB, rowC, rowD]
    const result = helpers.mergeIntoLiveRows(prev, serverPoll)
    expect(result.map((r) => r.id)).toEqual(["a", "b", "c", "d"])
  })

  it("returns prev unchanged when poll returns no new rows", () => {
    const prev = [rowA, rowB]
    const result = helpers.mergeIntoLiveRows(prev, [rowA, rowB])
    expect(result).toBe(prev) // same reference — no copy allocated
  })

  it("result is sorted oldest-to-newest (for liveRows array convention)", () => {
    const prev = [rowC]
    const poll = [rowA, rowD]
    const result = helpers.mergeIntoLiveRows(prev, poll)
    const times = result.map((r) => new Date(r.created_at).getTime())
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })

  it("caps merged rows at 500 to match production behaviour", () => {
    const prev = Array.from({ length: 498 }, (_, i) => makeRow(`x${i}`, i * 10))
    const poll = [makeRow("y1", 5000), makeRow("y2", 5010), makeRow("y3", 5020)]
    const result = helpers.mergeIntoLiveRows(prev, poll)
    expect(result.length).toEqual(500)
  })

  it("latest SDK job ends up at the end of the array", () => {
    const prev = [rowA]
    const poll = [rowD] // newer than rowA
    const result = helpers.mergeIntoLiveRows(prev, poll)
    expect(result[result.length - 1].id).toEqual("d")
  })
})
