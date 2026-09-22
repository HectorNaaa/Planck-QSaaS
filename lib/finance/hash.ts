/**
 * lib/finance/hash.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Deterministic snapshot hashing so every finance run can record exactly
 * which input snapshot it used (linage/reproducibility requirement).
 */
import { createHash } from "node:crypto"

/** Stable stringify: sorts object keys recursively so hash does not depend on key order. */
export function stableStringify(value: unknown): string {
  const seen = new WeakSet()
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v
    if (seen.has(v as object)) throw new Error("Cannot hash circular structure")
    seen.add(v as object)
    if (Array.isArray(v)) return v.map(walk)
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(v as Record<string, unknown>).sort()) {
      out[key] = walk((v as Record<string, unknown>)[key])
    }
    return out
  }
  return JSON.stringify(walk(value))
}

export function computeSnapshotHash(data: unknown): string {
  return createHash("sha256").update(stableStringify(data)).digest("hex")
}
