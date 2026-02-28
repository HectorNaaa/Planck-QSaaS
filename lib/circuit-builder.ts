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
 *   analyzeInputData(data)          → DataProfile
 *   buildCircuit(algorithm, profile) → BuiltCircuit
 *   SUPPORTED_ALGORITHMS            (string union type)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type SupportedAlgorithm = "vqe" | "qaoa" | "grover" | "shor" | "bell"

export interface DataProfile {
  /** Number of qubits required; clamped [2, 20]. */
  qubits: number
  /** Circuit depth estimate. */
  depth: number
  /** Total gate count estimate. */
  gateCount: number
  /** Normalised feature values in [0, π] — used as rotation angles. */
  angles: number[]
  /** Number of feature columns in the dataset. */
  featureCount: number
  /** Number of data rows / samples. */
  sampleCount: number
  /** Derived algorithmic complexity score [0, 1]. */
  complexity: number
}

export interface BuiltCircuit {
  qasm: string
  qubits: number
  depth: number
  gateCount: number
  algorithm: SupportedAlgorithm
  /** Human-readable parameter summary for the UI. */
  paramSummary: string
}

// ─── Data analysis ────────────────────────────────────────────────────────────

/**
 * Derive a DataProfile from arbitrary JSON/array input.
 * Called by the autoparser and SDK before circuit construction.
 */
export function analyzeInputData(data: unknown): DataProfile {
  const rows = normaliseRows(data)
  const sampleCount = rows.length || 1

  // Collect numeric column values
  const colValues: number[][] = []
  for (const row of rows) {
    const vals = numericValues(row)
    vals.forEach((v, i) => {
      if (!colValues[i]) colValues[i] = []
      colValues[i].push(v)
    })
  }
  const featureCount = Math.max(1, colValues.length)

  // Qubit count: log2(features) + 1, clamped [2, 20]
  const rawQubits = Math.ceil(Math.log2(featureCount + 1)) + 1
  const qubits = Math.min(20, Math.max(2, rawQubits))

  // Normalise each feature mean into [0, π] for rotation angles
  const angles = colValues.map((col) => {
    const mean = col.reduce((s, v) => s + v, 0) / col.length
    const max  = Math.max(...col.map(Math.abs)) || 1
    return (mean / max) * Math.PI
  })

  const complexity = Math.min(1, featureCount / 20 + sampleCount / 1000)
  const depth      = 2 + Math.round(complexity * 18) + qubits
  const gateCount  = depth * qubits

  return { qubits, depth, gateCount, angles, featureCount, sampleCount, complexity }
}

// ─── Circuit builders ─────────────────────────────────────────────────────────

/**
 * Build a parametric OpenQASM 2.0 circuit for the given algorithm and profile.
 * Every gate angle and register size is derived from `profile`.
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
  // Layer 1: parametric Ry rotations from data angles
  for (let i = 0; i < n; i++) {
    const θ = (p.angles[i % p.angles.length] ?? Math.PI / 4).toFixed(6)
    lines.push(`ry(${θ}) q[${i}];`)
  }
  // Layer 2: entangle chain
  for (let i = 0; i < n - 1; i++) lines.push(`cx q[${i}],q[${i + 1}];`)
  // Layer 3: Hadamard on first qubit
  lines.push("h q[0];")
  for (let i = 0; i < n; i++) lines.push(`measure q[${i}] -> c[${i}];`)

  const depth = 3 + Math.ceil(n / 2)
  return {
    qasm: lines.join("\n"),
    qubits: n, depth, gateCount: n + (n - 1) + 1 + n,
    algorithm: "bell",
    paramSummary: `${n} qubits, ${p.featureCount} features → Ry angles from data`,
  }
}

// ── Grover ────────────────────────────────────────────────────────────────────
function buildGrover(p: DataProfile): BuiltCircuit {
  const n = Math.max(2, Math.min(p.qubits, 10))
  // Grover iterations ≈ π/4 * √(2^n)
  const iterations = Math.max(1, Math.round((Math.PI / 4) * Math.sqrt(Math.pow(2, n))))
  const lines: string[] = [
    "OPENQASM 2.0;",
    'include "qelib1.inc";',
    `qreg q[${n}];`,
    `creg c[${n}];`,
  ]
  // Superposition
  for (let i = 0; i < n; i++) lines.push(`h q[${i}];`)

  for (let iter = 0; iter < iterations; iter++) {
    // Oracle: parametric phase kicks derived from data angles
    for (let i = 0; i < n; i++) {
      const φ = (p.angles[i % p.angles.length] ?? Math.PI).toFixed(6)
      lines.push(`rz(${φ}) q[${i}];`)
    }
    // Diffusion operator
    for (let i = 0; i < n; i++) lines.push(`h q[${i}];`)
    for (let i = 0; i < n; i++) lines.push(`x q[${i}];`)
    // Multi-controlled Z via CX chain
    for (let i = 0; i < n - 1; i++) lines.push(`cx q[${i}],q[${n - 1}];`)
    lines.push(`h q[${n - 1}];`)
    for (let i = 0; i < n - 1; i++) lines.push(`cx q[${i}],q[${n - 1}];`)
    lines.push(`h q[${n - 1}];`)
    for (let i = 0; i < n; i++) lines.push(`x q[${i}];`)
    for (let i = 0; i < n; i++) lines.push(`h q[${i}];`)
  }

  for (let i = 0; i < n; i++) lines.push(`measure q[${i}] -> c[${i}];`)
  const gc = n + iterations * (n + n + (n - 1) + 1 + (n - 1) + 1 + n + n) + n
  return {
    qasm: lines.join("\n"),
    qubits: n, depth: n + iterations * (6 + 2 * n), gateCount: gc,
    algorithm: "grover",
    paramSummary: `${n} qubits, ${iterations} iteration(s), Rz angles from data`,
  }
}

// ── Shor ──────────────────────────────────────────────────────────────────────
function buildShor(p: DataProfile): BuiltCircuit {
  // For Shor we use counting register size derived from feature count
  const n = Math.max(3, Math.min(p.qubits, 8))
  const m = Math.max(2, Math.floor(n / 2))  // ancilla register
  const lines: string[] = [
    "OPENQASM 2.0;",
    'include "qelib1.inc";',
    `qreg q[${n}];`,
    `qreg anc[${m}];`,
    `creg c[${n}];`,
  ]
  // QFT on counting register
  for (let i = 0; i < n; i++) lines.push(`h q[${i}];`)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const k = j - i + 1
      const θ = (Math.PI / Math.pow(2, k - 1)).toFixed(6)
      lines.push(`cu1(${θ}) q[${i}],q[${j}];`)
    }
  }
  // Modular exponentiation: parametric rotations on ancilla from data angles
  for (let i = 0; i < m; i++) {
    const θ = (p.angles[i % p.angles.length] ?? Math.PI / 2).toFixed(6)
    lines.push(`ry(${θ}) anc[${i}];`)
    lines.push(`cx anc[${i}],q[${i % n}];`)
  }
  // Inverse QFT
  for (let i = n - 1; i >= 0; i--) {
    for (let j = n - 1; j > i; j--) {
      const k = j - i + 1
      const θ = (-(Math.PI / Math.pow(2, k - 1))).toFixed(6)
      lines.push(`cu1(${θ}) q[${i}],q[${j}];`)
    }
    lines.push(`h q[${i}];`)
  }
  for (let i = 0; i < n; i++) lines.push(`measure q[${i}] -> c[${i}];`)
  const gc = n + (n * (n - 1)) / 2 + 2 * m + (n * (n - 1)) / 2 + n + n
  return {
    qasm: lines.join("\n"),
    qubits: n + m, depth: 3 * n + m, gateCount: gc,
    algorithm: "shor",
    paramSummary: `${n} counting + ${m} ancilla qubits, angles from data`,
  }
}

// ── VQE ───────────────────────────────────────────────────────────────────────
function buildVQE(p: DataProfile): BuiltCircuit {
  const n = Math.max(2, Math.min(p.qubits, 12))
  // Layers: depth controls entanglement layers
  const layers = Math.max(1, Math.round(p.complexity * 3) + 1)
  const lines: string[] = [
    "OPENQASM 2.0;",
    'include "qelib1.inc";',
    `qreg q[${n}];`,
    `creg c[${n}];`,
  ]
  let angleIdx = 0
  for (let l = 0; l < layers; l++) {
    // Ry + Rz single-qubit layer
    for (let i = 0; i < n; i++) {
      const θy = (p.angles[angleIdx++ % p.angles.length] ?? Math.PI / 4).toFixed(6)
      const θz = (p.angles[angleIdx++ % p.angles.length] ?? Math.PI / 4).toFixed(6)
      lines.push(`ry(${θy}) q[${i}];`)
      lines.push(`rz(${θz}) q[${i}];`)
    }
    // Entanglement: alternating CX pairs
    const offset = l % 2
    for (let i = offset; i < n - 1; i += 2) lines.push(`cx q[${i}],q[${i + 1}];`)
  }
  for (let i = 0; i < n; i++) lines.push(`measure q[${i}] -> c[${i}];`)
  const gc = layers * (2 * n + Math.floor((n - 1) / 2) + 1) + n
  return {
    qasm: lines.join("\n"),
    qubits: n, depth: layers * 3, gateCount: gc,
    algorithm: "vqe",
    paramSummary: `${n} qubits, ${layers} ansatz layer(s), Ry/Rz from data`,
  }
}

// ── QAOA ──────────────────────────────────────────────────────────────────────
function buildQAOA(p: DataProfile): BuiltCircuit {
  const n = Math.max(2, Math.min(p.qubits, 14))
  const depth = Math.max(1, Math.round(p.complexity * 4) + 1)
  const lines: string[] = [
    "OPENQASM 2.0;",
    'include "qelib1.inc";',
    `qreg q[${n}];`,
    `creg c[${n}];`,
  ]
  for (let i = 0; i < n; i++) lines.push(`h q[${i}];`)

  let angleIdx = 0
  for (let d = 0; d < depth; d++) {
    // Cost layer: ZZ interactions with data-derived gamma
    for (let i = 0; i < n - 1; i++) {
      const γ = (p.angles[angleIdx++ % p.angles.length] ?? Math.PI / 3).toFixed(6)
      lines.push(`cx q[${i}],q[${i + 1}];`)
      lines.push(`rz(${γ}) q[${i + 1}];`)
      lines.push(`cx q[${i}],q[${i + 1}];`)
    }
    // Mixer layer: Rx rotations with data-derived beta
    for (let i = 0; i < n; i++) {
      const β = (p.angles[angleIdx++ % p.angles.length] ?? Math.PI / 4).toFixed(6)
      lines.push(`rx(${β}) q[${i}];`)
    }
  }
  for (let i = 0; i < n; i++) lines.push(`measure q[${i}] -> c[${i}];`)
  const gc = n + depth * (3 * (n - 1) + n) + n
  return {
    qasm: lines.join("\n"),
    qubits: n, depth: 1 + depth * 4, gateCount: gc,
    algorithm: "qaoa",
    paramSummary: `${n} qubits, ${depth} QAOA layer(s), γ/β from data`,
  }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

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
