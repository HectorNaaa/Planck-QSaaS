/**
 * lib/finance/random.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Deterministic, seeded PRNG utilities used by the finance twins so every run
 * is reproducible from (snapshotHash, seed). Not cryptographically secure —
 * never use for auth/security purposes.
 */

/** mulberry32 — small, fast, deterministic 32-bit PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Standard normal sample via Box-Muller, using a seeded uniform generator. */
export function makeGaussianSampler(seed: number): () => number {
  const rng = mulberry32(seed)
  let spare: number | null = null
  return function next(): number {
    if (spare !== null) {
      const v = spare
      spare = null
      return v
    }
    let u = 0
    let v = 0
    // avoid log(0)
    while (u === 0) u = rng()
    while (v === 0) v = rng()
    const mag = Math.sqrt(-2 * Math.log(u))
    const z0 = mag * Math.cos(2 * Math.PI * v)
    const z1 = mag * Math.sin(2 * Math.PI * v)
    spare = z1
    return z0
  }
}

/** Derives a stable 32-bit integer seed from a string (e.g. a snapshot hash + salt). */
export function seedFromString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
