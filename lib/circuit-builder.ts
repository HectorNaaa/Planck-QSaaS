/**
 * circuit-builder.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Authoritative parametric OpenQASM 2.0 circuit generator.
 *
 * All register sizes, rotation angles, and gate sequences are derived from the
 * caller's `DataProfile` (extracted from the uploaded dataset) — nothing is
 * hardcoded or random. The same entry-point is shared by:
 *   - lib/qasm-processor.ts        (server-side generation)
 *   - app/api/quantum/generate-circuit/route.ts
 *   - components/runner/autoparser.tsx  (via analyzeInputData)
 *   - SDK calls routed through the simulate API
 *
 * Public API (all re-exported from this file):
 *   analyzeInputData(data, opts?)    → DataProfile
 *   buildCircuit(algorithm, profile) → BuiltCircuit
 *   SUPPORTED_ALGORITHMS             (string union type)
 *
 * Data-scale tiers (sampleCount):
 *   small   < 1 000      — full feature embedding, standard ansatz
 *   medium  < 50 000     — sampled stats, compact layers
 *   large   < 10 000 000 — log-compressed qubits, amplitude encoding
 *   massive ≥ 10 000 000 — maximum qubit compression, repeated amplitude layers
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type SupportedAlgorithm = "vqe" | "qaoa" | "grover" | "shor" | "bell" | "qft"
export type DataScale = "small" | "medium" | "large" | "massive"

/** Optional caller hints forwarded from the SDK or UI. */
export interface BuildOptions {
  /** Hard cap on qubit count (2–20). Overrides the auto-derived value. */
  maxQubits?:   number
  /** Hint to limit circuit depth / layer count. */
  maxDepth?:    number
  /** Multiply all data-derived rotation angles by this factor (default 1.0). */
  angleScale?:  number
  /** Override the auto-computed VQE / QAOA layer count. */
  forceLayers?: number
  /**
   * True sample count when the caller pre-sampled a large dataset before
   * sending. Circuit scaling (qubits, layers, dataScale) uses this value
   * instead of `data.length` so a 100M-row dataset correctly produces a
   * larger circuit even though only 5K rows are forwarded in the payload.
   */
  sampleCountHint?: number
}

export interface DataProfile {
  /** Number of qubits required; clamped [2, 20] (further bounded by buildOptions). */
  qubits: number
  /** Circuit depth estimate. */
  depth: number
  /** Total gate count estimate. */
  gateCount: number
  /** Normalised feature statistics in [0, π] — used as rotation angles. */
  angles: number[]
  /** Number of feature columns in the dataset. */
  featureCount: number
  /** Number of data rows / samples (actual, not sampled count). */
  sampleCount: number
  /** Derived algorithmic complexity score [0, 1]. */
  complexity: number
  /** Dataset size tier driving circuit structure. */
  dataScale: DataScale
  /** Ansatz / QAOA layer count derived from data and options. */
  layers: number
  /** BuildOptions snapshot merged into this profile. */
  buildOptions: BuildOptions
}

export interface BuiltCircuit {
  qasm: string
  qubits: number
  depth: number
  gateCount: number
  algorithm: SupportedAlgorithm
  /** Human-readable parameter summary for the UI. */
  paramSummary: string
  /** Dataset size tier that shaped this circuit. */
  dataScale: DataScale
  /** Layer count used (VQE / QAOA). */
  layers: number
}

// ─── Constants ────────────────────────────────────────────────────────────────
// Maximum rows to keep in memory for statistics when dataset is large.
// Beyond this threshold we sample systematically.
const STATS_SAMPLE_CAP = 5_000

// ─── Data analysis ────────────────────────────────────────────────────────────

/**
 * Derive a DataProfile from arbitrary JSON/array input.
 * Called by the autoparser and SDK before circuit construction.
 *
 * IMPORTANT — large-data safety:
 *   When the dataset has more than STATS_SAMPLE_CAP rows we perform systematic
 *   sampling so memory usage is O(STATS_SAMPLE_CAP) regardless of input size.
 *   The returned `sampleCount` always reflects the FULL dataset size so the
 *   qubit/layer scaling is based on actual data volume.
 */
export function analyzeInputData(data: unknown, opts: BuildOptions = {}): DataProfile {
  const allRows     = normaliseRows(data)
  // Use the caller-supplied hint when the SDK pre-sampled a large dataset
  const sampleCount = (typeof opts.sampleCountHint === "number" && opts.sampleCountHint > 0)
    ? opts.sampleCountHint
    : (allRows.length || 1)

  // Determine data scale tier FIRST — used for qubit/layer decisions
  const dataScale = classifyDataScale(sampleCount)

  // Systematic sample to keep memory bounded
  const rows = sampleRows(allRows, STATS_SAMPLE_CAP)

  // Collect numeric column values from the sample
  const colValues: number[][] = []
  for (const row of rows) {
    const vals = numericValues(row)
    vals.forEach((v, i) => {
      if (!colValues[i]) colValues[i] = []
      colValues[i].push(v)
    })
  }
  const featureCount = Math.max(1, colValues.length)

  // ── Qubit count ─────────────────────────────────────────────────────────────
  // Base: ceil(log2(features + 1)) + 1
  // Scale bonus from data volume: adds up to +4 qubits for massive datasets
  //   bonus = floor(log2(log2(sampleCount + 1) + 1))  → 0 for <1K, up to 4 for 10M+
  const qBonus   = Math.floor(Math.log2(Math.log2(sampleCount + 1) + 1))
  const rawQubits = Math.ceil(Math.log2(featureCount + 1)) + 1 + qBonus
  const capQ     = typeof opts.maxQubits === "number"
    ? Math.min(opts.maxQubits, 20)
    : 20
  const qubits = Math.min(capQ, Math.max(2, rawQubits))

  // ── Angles ──────────────────────────────────────────────────────────────────
  // Compute column mean normalised to [0, π]; apply optional angleScale
  const aScale = typeof opts.angleScale === "number" ? opts.angleScale : 1.0
  const angles = colValues.map((col): number => {
    const mean = col.reduce((s, v) => s + v, 0) / col.length
    const max  = Math.max(...col.map(Math.abs)) || 1
    return Math.min(2 * Math.PI, Math.abs((mean / max) * Math.PI * aScale))
  })
  // Guarantee at least one angle
  if (angles.length === 0) angles.push(Math.PI / 4)

  // ── Complexity ──────────────────────────────────────────────────────────────
  // Uses log scale for sampleCount so 100 vs 100M genuinely differ.
  // log2(1) = 0 … log2(1e8) ≈ 26.6  → normalise to [0, 1] over 30 decades of log2
  const logSamples  = Math.log2(sampleCount + 1)
  const complexity  = Math.min(1, featureCount / 20 + logSamples / 30)

  // ── Layers ──────────────────────────────────────────────────────────────────
  // Layer count grows with complexity and dataScale; forceLayers overrides.
  const baseLayers = Math.max(1, Math.round(complexity * 4) + 1)
  const scaledLayers: Record<DataScale, number> = {
    small:   baseLayers,
    medium:  baseLayers + 1,
    large:   baseLayers + 2,
    massive: baseLayers + 3,
  }
  const layers = typeof opts.forceLayers === "number" && opts.forceLayers > 0
    ? opts.forceLayers
    : scaledLayers[dataScale]

  const capD      = typeof opts.maxDepth === "number" ? opts.maxDepth : Infinity
  const depth     = Math.min(capD, 2 + Math.round(complexity * 18) + qubits)
  const gateCount = depth * qubits

  return {
    qubits,
    depth,
    gateCount,
    angles,
    featureCount,
    sampleCount,
    complexity,
    dataScale,
    layers,
    buildOptions: opts,
  }
}

/** Classify a sample count into a DataScale tier. */
function classifyDataScale(n: number): DataScale {
  if (n < 1_000)       return "small"
  if (n < 50_000)      return "medium"
  if (n < 10_000_000)  return "large"
  return "massive"
}

/**
 * Return at most `cap` rows from `all` using systematic sampling.
 * When all.length <= cap, the original array is returned unchanged (no copy).
 */
function sampleRows(all: unknown[], cap: number): unknown[] {
  if (all.length <= cap) return all
  const step = Math.floor(all.length / cap)
  const out: unknown[] = []
  for (let i = 0; i < all.length && out.length < cap; i += step) {
    out.push(all[i])
  }
  return out
}

// ─── Circuit builders ─────────────────────────────────────────────────────────

/**
 * Build a parametric OpenQASM 2.0 circuit for the given algorithm and profile.
 * Every gate angle, register size, and layer count is derived from `profile`
 * which encodes the true data volume via `dataScale` and `layers`.
 */
export function buildCircuit(
  algorithm: SupportedAlgorithm,
  profile: DataProfile,
): BuiltCircuit {
  switch (algorithm) {
    case "bell":   return buildBell(profile)
    case "grover": return buildGrover(profile)
    case "shor":   return buildShor(profile)
    case "vqe":    return buildVQE(profile)
    case "qaoa":   return buildQAOA(profile)
    case "qft":    return buildQFT(profile)
  }
}

// ── Bell / entanglement ───────────────────────────────────────────────────────
function buildBell(p: DataProfile): BuiltCircuit {
  const n = Math.max(2, Math.min(p.qubits, 6)) // Bell: 2-6 qubits
  const lines: string[] = [
    "OPENQASM 2.0;",
    'include "qelib1.inc";',
    `qreg q[${n}];`,
    `creg c[${n}];`,
  ]
  for (let i = 0; i < n; i++) {
    const θ = angle(p, i).toFixed(6)
    lines.push(`ry(${θ}) q[${i}];`)
  }
  for (let i = 0; i < n - 1; i++) lines.push(`cx q[${i}],q[${i + 1}];`)
  lines.push("h q[0];")
  for (let i = 0; i < n; i++) lines.push(`measure q[${i}] -> c[${i}];`)

  const depth = 3 + Math.ceil(n / 2)
  return {
    qasm: lines.join("\n"),
    qubits: n, depth, gateCount: n + (n - 1) + 1 + n,
    algorithm: "bell",
    dataScale: p.dataScale, layers: 1,
    paramSummary: `${n} qubits [${p.dataScale}], ${p.featureCount} features → Ry angles from data`,
  }
}

// ── Grover ────────────────────────────────────────────────────────────────────
function buildGrover(p: DataProfile): BuiltCircuit {
  const n = Math.max(2, Math.min(p.qubits, 10))
  const large = p.dataScale === "large" || p.dataScale === "massive"
  // For large data: M (marked states) grows with log2(sampleCount) → reduces iterations
  const M = large ? Math.max(1, Math.floor(Math.log2(p.sampleCount))) : 1
  const iterations = Math.max(1, Math.round((Math.PI / 4) * Math.sqrt(Math.pow(2, n) / M)))

  const lines: string[] = [
    "OPENQASM 2.0;",
    'include "qelib1.inc";',
    `qreg q[${n}];`,
    `creg c[${n}];`,
  ]
  for (let i = 0; i < n; i++) lines.push(`h q[${i}];`)

  let ai = 0
  for (let iter = 0; iter < iterations; iter++) {
    // Oracle: parametric phase kicks from data angles
    for (let i = 0; i < n; i++) {
      lines.push(`rz(${angle(p, ai++).toFixed(6)}) q[${i}];`)
    }
    // For large/massive: extra amplitude encoding Ry+Rz layer in oracle
    if (large) {
      for (let i = 0; i < n; i++) lines.push(`ry(${angle(p, ai++).toFixed(6)}) q[${i}];`)
      for (let i = 0; i < n; i++) lines.push(`rz(${angle(p, ai++).toFixed(6)}) q[${i}];`)
    }
    // Diffusion operator
    for (let i = 0; i < n; i++) lines.push(`h q[${i}];`)
    for (let i = 0; i < n; i++) lines.push(`x q[${i}];`)
    for (let i = 0; i < n - 1; i++) lines.push(`cx q[${i}],q[${n - 1}];`)
    lines.push(`h q[${n - 1}];`)
    for (let i = 0; i < n - 1; i++) lines.push(`cx q[${i}],q[${n - 1}];`)
    lines.push(`h q[${n - 1}];`)
    for (let i = 0; i < n; i++) lines.push(`x q[${i}];`)
    for (let i = 0; i < n; i++) lines.push(`h q[${i}];`)
  }

  for (let i = 0; i < n; i++) lines.push(`measure q[${i}] -> c[${i}];`)
  const gc = n + iterations * (n * (large ? 3 : 1) + n + n + (n - 1) + 1 + (n - 1) + 1 + n + n) + n
  return {
    qasm: lines.join("\n"),
    qubits: n, depth: n + iterations * (6 + 2 * n), gateCount: gc,
    algorithm: "grover",
    dataScale: p.dataScale, layers: iterations,
    paramSummary: `${n} qubits [${p.dataScale}], ${iterations} iteration(s) (M=${M}), Rz angles from data`,
  }
}

// ── Shor ──────────────────────────────────────────────────────────────────────
function buildShor(p: DataProfile): BuiltCircuit {
  const n = Math.max(3, Math.min(p.qubits, 8))
  const m = Math.max(2, Math.floor(n / 2))
  const lines: string[] = [
    "OPENQASM 2.0;",
    'include "qelib1.inc";',
    `qreg q[${n}];`,
    `qreg anc[${m}];`,
    `creg c[${n}];`,
  ]
  for (let i = 0; i < n; i++) lines.push(`h q[${i}];`)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const k = j - i + 1
      lines.push(`cu1(${(Math.PI / Math.pow(2, k - 1)).toFixed(6)}) q[${i}],q[${j}];`)
    }
  }
  let ai = 0
  for (let i = 0; i < m; i++) {
    lines.push(`ry(${angle(p, ai++).toFixed(6)}) anc[${i}];`)
    lines.push(`cx anc[${i}],q[${i % n}];`)
  }
  for (let i = n - 1; i >= 0; i--) {
    for (let j = n - 1; j > i; j--) {
      const k = j - i + 1
      lines.push(`cu1(${(-(Math.PI / Math.pow(2, k - 1))).toFixed(6)}) q[${i}],q[${j}];`)
    }
    lines.push(`h q[${i}];`)
  }
  for (let i = 0; i < n; i++) lines.push(`measure q[${i}] -> c[${i}];`)
  const gc = n + (n * (n - 1)) / 2 + 2 * m + (n * (n - 1)) / 2 + n + n
  return {
    qasm: lines.join("\n"),
    qubits: n + m, depth: 3 * n + m, gateCount: gc,
    algorithm: "shor",
    dataScale: p.dataScale, layers: 1,
    paramSummary: `${n} counting + ${m} ancilla qubits [${p.dataScale}], angles from data`,
  }
}

// ── VQE ───────────────────────────────────────────────────────────────────────
function buildVQE(p: DataProfile): BuiltCircuit {
  const n      = Math.max(2, Math.min(p.qubits, 12))
  const layers = p.layers
  const large  = p.dataScale === "large" || p.dataScale === "massive"

  const lines: string[] = [
    "OPENQASM 2.0;",
    'include "qelib1.inc";',
    `qreg q[${n}];`,
    `creg c[${n}];`,
  ]
  let ai = 0
  for (let l = 0; l < layers; l++) {
    // Ry + Rz single-qubit layer
    for (let i = 0; i < n; i++) {
      lines.push(`ry(${angle(p, ai++).toFixed(6)}) q[${i}];`)
      lines.push(`rz(${angle(p, ai++).toFixed(6)}) q[${i}];`)
    }
    // For large/massive: extra Rx amplitude-encoding layer
    if (large) {
      for (let i = 0; i < n; i++) lines.push(`rx(${angle(p, ai++).toFixed(6)}) q[${i}];`)
    }
    // Alternating CX entanglement
    const offset = l % 2
    for (let i = offset; i < n - 1; i += 2) lines.push(`cx q[${i}],q[${i + 1}];`)
    // Reverse entanglement for massive to increase expressibility
    if (p.dataScale === "massive") {
      for (let i = n - 1; i > 1; i -= 2) lines.push(`cx q[${i}],q[${i - 1}];`)
    }
  }
  for (let i = 0; i < n; i++) lines.push(`measure q[${i}] -> c[${i}];`)

  const gatesPerLayer = 2 * n + (large ? n : 0) + Math.floor((n - 1) / 2) + 1
  const gc = layers * gatesPerLayer + n
  return {
    qasm: lines.join("\n"),
    qubits: n, depth: layers * (large ? 4 : 3), gateCount: gc,
    algorithm: "vqe",
    dataScale: p.dataScale, layers,
    paramSummary: `${n} qubits [${p.dataScale}], ${layers} ansatz layer(s), Ry/Rz${large ? "/Rx" : ""} from data`,
  }
}

// ── QAOA ──────────────────────────────────────────────────────────────────────
function buildQAOA(p: DataProfile): BuiltCircuit {
  const n      = Math.max(2, Math.min(p.qubits, 14))
  const layers = p.layers
  const large  = p.dataScale === "large" || p.dataScale === "massive"

  const lines: string[] = [
    "OPENQASM 2.0;",
    'include "qelib1.inc";',
    `qreg q[${n}];`,
    `creg c[${n}];`,
  ]
  for (let i = 0; i < n; i++) lines.push(`h q[${i}];`)

  let ai = 0
  for (let d = 0; d < layers; d++) {
    // Cost layer: nearest-neighbour ZZ
    for (let i = 0; i < n - 1; i++) {
      const γ = angle(p, ai++).toFixed(6)
      lines.push(`cx q[${i}],q[${i + 1}];`)
      lines.push(`rz(${γ}) q[${i + 1}];`)
      lines.push(`cx q[${i}],q[${i + 1}];`)
    }
    // For large/massive: long-range ZZ connecting i to i+2
    if (large && n > 3) {
      for (let i = 0; i < n - 2; i += 2) {
        const γ = angle(p, ai++).toFixed(6)
        lines.push(`cx q[${i}],q[${i + 2}];`)
        lines.push(`rz(${γ}) q[${i + 2}];`)
        lines.push(`cx q[${i}],q[${i + 2}];`)
      }
    }
    // Mixer layer: Rx
    for (let i = 0; i < n; i++) {
      lines.push(`rx(${angle(p, ai++).toFixed(6)}) q[${i}];`)
    }
  }
  for (let i = 0; i < n; i++) lines.push(`measure q[${i}] -> c[${i}];`)

  const longRangeZZ = large && n > 3 ? Math.floor((n - 2) / 2) * 3 : 0
  const gc = n + layers * (3 * (n - 1) + longRangeZZ + n) + n
  return {
    qasm: lines.join("\n"),
    qubits: n, depth: 1 + layers * (large ? 6 : 4), gateCount: gc,
    algorithm: "qaoa",
    dataScale: p.dataScale, layers,
    paramSummary: `${n} qubits [${p.dataScale}], ${layers} QAOA layer(s)${large ? " + long-range ZZ" : ""}, γ/β from data`,
  }
}

// ── QFT ───────────────────────────────────────────────────────────────────────
function buildQFT(p: DataProfile): BuiltCircuit {
  const n = Math.max(2, Math.min(p.qubits, 8))
  const lines: string[] = [
    "OPENQASM 2.0;",
    'include "qelib1.inc";',
    `qreg q[${n}];`,
    `creg c[${n}];`,
  ]
  for (let i = 0; i < n; i++) {
    lines.push(`ry(${angle(p, i).toFixed(6)}) q[${i}];`)
  }
  for (let i = 0; i < n; i++) {
    lines.push(`h q[${i}];`)
    for (let j = i + 1; j < n; j++) {
      const k = j - i + 1
      lines.push(`cu1(${(Math.PI / Math.pow(2, k - 1)).toFixed(6)}) q[${i}],q[${j}];`)
    }
  }
  for (let i = 0; i < Math.floor(n / 2); i++) {
    lines.push(`swap q[${i}],q[${n - 1 - i}];`)
  }
  for (let i = 0; i < n; i++) lines.push(`measure q[${i}] -> c[${i}];`)
  const gc = n + n + n * (n - 1) / 2 + Math.floor(n / 2) + n
  return {
    qasm: lines.join("\n"),
    qubits: n, depth: n + n + Math.floor(n / 2), gateCount: gc,
    algorithm: "qft",
    dataScale: p.dataScale, layers: 1,
    paramSummary: `${n}-qubit QFT [${p.dataScale}], Ry init from ${p.featureCount} feature(s)`,
  }
}

/** Convenience: angle[idx % length] with fallback. */
function angle(p: DataProfile, idx: number): number {
  return p.angles[idx % p.angles.length] ?? Math.PI / 4
}

// ─── Private helpers ───────────────────────────────────────────────────────────

function normaliseRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === "object") {
    // { rows: [...] } or { data: [...] }
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.rows)) return obj.rows
    if (Array.isArray(obj.data)) return obj.data
    return [data]
  }
  if (typeof data === "string") {
    try { return normaliseRows(JSON.parse(data)) } catch { return [] }
  }
  return []
}

function numericValues(row: unknown): number[] {
  if (Array.isArray(row)) return row.filter((v) => typeof v === "number") as number[]
  if (row && typeof row === "object") {
    return Object.values(row as Record<string, unknown>)
      .filter((v) => typeof v === "number") as number[]
  }
  if (typeof row === "number") return [row]
  return []
}
