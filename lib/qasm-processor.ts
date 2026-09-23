/**
 * qasm-processor.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-side quantum circuit façade. Delegates QASM generation to
 * lib/circuit-builder.ts (data-driven, parametric) and:
 *   1. For large/massive datasets (≥ 50 K samples): spawns the fast C++ circuit
 *      generator (scripts/generate_circuit) that receives the pre-computed
 *      data-profile JSON and writes OpenQASM 2.0 directly.
 *   2. Pipes the generated QASM through the compiled C++ gate-optimiser
 *      (scripts/transpile_circuit) for fusion/cancellation.
 *   3. Falls back to pure-TS for all steps when the binaries are absent.
 *
 * Public API — named exports:
 *   generateCircuit(algorithm, data, opts?) → Promise<QuantumCircuit>
 *   analyzeCircuit(qasm)                    → CircuitStats
 *   transpileWithCpp(qasm)                  → Promise<{ qasm, used }>
 */

import { execFile, spawn } from "child_process"
import { promisify } from "util"
import { existsSync } from "fs"
import { join } from "path"
import {
  analyzeInputData,
  buildCircuit,
  type BuildOptions,
  type DataProfile,
  type SupportedAlgorithm,
} from "@/lib/circuit-builder"

const execFileAsync = promisify(execFile)

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface GateInfo {
  type: string
  qubits: number[]
  angle?: number
}

export interface QuantumCircuit {
  qasm: string
  qubits: number
  depth: number
  gates: GateInfo[]
  recommended_shots: number
  gate_count: number
  algorithm: string
  /** Human-readable summary of how the data shaped the circuit parameters. */
  paramSummary: string
  /** Whether the C++ transpiler pass was applied. */
  transpiled: boolean
  /** Whether the Quark gate-cancellation optimizer actually ran (false if disabled, unavailable, or errored). */
  quarkApplied: boolean
  /** Dataset size tier that shaped this circuit. */
  dataScale: string
  /** Ansatz / iteration layer count used. */
  layers: number
}

export interface CircuitStats {
  qubits: number
  depth: number
  gateCount: number
  circuitType: string
}

// ─── Child process stdin helper ──────────────────────────────────────────────

function runProcessWithStdin(
  command: string,
  args: string[],
  input: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { timeout: 10000 })
    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    child.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    child.on("error", (err) => {
      reject(err)
    })

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(`Process exited with code ${code}: ${stderr}`))
      }
    })

    if (child.stdin) {
      child.stdin.write(input)
      child.stdin.end()
    } else {
      reject(new Error("Failed to open stdin stream"))
    }
  })
}

// ─── C++ binaries ─────────────────────────────────────────────────────────────

const CPP_GENERATE  = join(process.cwd(), "scripts", "generate_circuit")
const CPP_TRANSPILE = join(process.cwd(), "scripts", "transpile_circuit")

const isWindows = process.platform === "win32"
const GEN_EXE = isWindows ? `${CPP_GENERATE}.exe` : CPP_GENERATE
const XPL_EXE = isWindows ? `${CPP_TRANSPILE}.exe` : CPP_TRANSPILE

const GEN_AVAILABLE = existsSync(GEN_EXE)
const XPL_AVAILABLE = existsSync(XPL_EXE)

// Threshold: use C++ generator when dataset has ≥ this many samples
const CPP_GEN_THRESHOLD = 50_000

/**
 * Generate OpenQASM 2.0 using the C++ generator binary.
 * The data-profile JSON is serialised and piped to stdin.
 * Returns null if binary absent or generation fails → caller falls back to TS.
 */
async function generateWithCpp(
  algo: SupportedAlgorithm,
  profile: DataProfile,
): Promise<string | null> {
  if (!GEN_AVAILABLE) return null
  const payload = JSON.stringify({
    algorithm:    algo,
    qubits:       profile.qubits,
    depth:        profile.depth,
    layers:       profile.layers,
    gateCount:    profile.gateCount,
    angles:       profile.angles,
    dataScale:    profile.dataScale,
    sampleCount:  profile.sampleCount,
    featureCount: profile.featureCount,
    angleScale:   profile.buildOptions.angleScale ?? 1.0,
    maxQubits:    profile.buildOptions.maxQubits ?? null,
    forceLayers:  profile.buildOptions.forceLayers ?? null,
  })
  try {
    const stdout = await runProcessWithStdin(GEN_EXE, [], payload)
    const s = stdout.trim()
    return s.startsWith("OPENQASM") ? s : null
  } catch {
    return null
  }
}

/**
 * Pipe QASM through the compiled C++ gate-optimiser when available.
 * Returns the original string unchanged if the binary is absent or errors.
 */
export async function transpileWithCpp(
  qasm: string,
): Promise<{ qasm: string; used: boolean }> {
  if (!XPL_AVAILABLE) return { qasm, used: false }
  try {
    const stdout = await runProcessWithStdin(XPL_EXE, [], qasm)
    return { qasm: stdout.trim(), used: true }
  } catch {
    return { qasm, used: false }
  }
}

/**
 * Pipe QASM through the Python Quark compiler (Clifford+T optimization pass).
 * Returns the original string unchanged if execution fails.
 */
export async function transpileWithQuark(
  qasm: string,
): Promise<{ qasm: string; used: boolean }> {
  const scriptPath = join(process.cwd(), "scripts", "transpile_quark.py")
  
  // Try running with 'python'
  try {
    const stdout = await runProcessWithStdin("python", [scriptPath], qasm)
    return { qasm: stdout.trim(), used: true }
  } catch {
    // Try running with 'python3' as fallback
    try {
      const stdout = await runProcessWithStdin("python3", [scriptPath], qasm)
      return { qasm: stdout.trim(), used: true }
    } catch {
      return { qasm, used: false }
    }
  }
}

/**
 * Run the full transpilation pipeline: C++ gate fusion/cancellation, then the
 * Python Quark gate-cancellation optimizer. Pass `{ quark: false }` to skip the
 * Quark stage entirely (e.g. the user disabled it for this run).
 */
export async function transpileCircuitPipeline(
  qasm: string,
  opts: { quark?: boolean } = {},
): Promise<{ qasm: string; used: boolean; cppApplied: boolean; quarkApplied: boolean }> {
  let currentQasm = qasm
  let cppApplied = false
  let quarkApplied = false

  // 1. Run C++ transpile pass if available
  const cppRes = await transpileWithCpp(currentQasm)
  if (cppRes.used) {
    currentQasm = cppRes.qasm
    cppApplied = true
  }

  // 2. Run Quark transpile pass, unless explicitly disabled for this run
  const quarkEnabled = opts.quark !== false
  if (quarkEnabled) {
    const quarkRes = await transpileWithQuark(currentQasm)
    if (quarkRes.used) {
      currentQasm = quarkRes.qasm
      quarkApplied = true
    }
  }

  return { qasm: currentQasm, used: cppApplied || quarkApplied, cppApplied, quarkApplied }
}

// ─── Core functions ────────────────────────────────────────────────────────────

/**
 * Build a parametric circuit from uploaded data, then optimise via C++.
 * All register sizes, rotation angles, and gate structure are derived from
 * the data profile — nothing is hardcoded.
 *
 * Pipeline:
 *   1. analyzeInputData()        → safe O(5K) sample, real log-scale complexity
 *   2. C++ generator (if large)  → fast QASM directly from profile JSON
 *      OR TS buildCircuit()      → pure-TS fallback
 *   3. Transpiler pipeline      → gate fusion + CX cancellation (C++) + Quark optimization
 */
export async function generateCircuit(
  algorithm: string,
  data: unknown,
  opts: BuildOptions = {},
): Promise<QuantumCircuit> {
  const algo    = sanitizeAlgorithm(algorithm)
  const profile: DataProfile = analyzeInputData(data, opts)

  let rawQasm: string
  let usedNativeGen = false

  // Use the fast C++ generator for large / massive datasets
  if (profile.sampleCount >= CPP_GEN_THRESHOLD && GEN_AVAILABLE) {
    const nativeQasm = await generateWithCpp(algo, profile)
    if (nativeQasm) {
      rawQasm       = nativeQasm
      usedNativeGen = true
    } else {
      rawQasm = buildCircuit(algo, profile).qasm
    }
  } else {
    rawQasm = buildCircuit(algo, profile).qasm
  }

  const { qasm, used: transpiled, quarkApplied } = await transpileCircuitPipeline(rawQasm, { quark: opts.quarkOptimizer !== false })
  const built = buildCircuit(algo, profile) // re-run for metadata (cheap)

  return {
    qasm,
    qubits:            built.qubits,
    depth:             built.depth,
    gates:             parseQASMToGates(qasm),
    recommended_shots: recommendShots(profile),
    gate_count:        built.gateCount,
    algorithm:         algo,
    paramSummary:      built.paramSummary,
    transpiled:        transpiled || usedNativeGen,
    quarkApplied,
    dataScale:         profile.dataScale,
    layers:            profile.layers,
  }
}

/**
 * Analyse an existing QASM string without running simulation.
 * Used by the visualise and transpile routes.
 */
export function analyzeCircuit(qasm: string): CircuitStats {
  const qubits    = extractQubits(qasm)
  const gateCount = countGates(qasm)
  const depth     = Math.max(1, Math.ceil(gateCount / Math.max(1, qubits)))
  const circuitType = detectCircuitType(qasm)
  return { qubits, depth, gateCount, circuitType }
}

// ─── Class wrapper (backwards-compat) ─────────────────────────────────────────

export class QASMProcessor {
  static generateCircuit = generateCircuit
  static analyzeCircuit  = analyzeCircuit
}

// ─── Private helpers ───────────────────────────────────────────────────────────

function sanitizeAlgorithm(raw: string): SupportedAlgorithm {
  const supported: SupportedAlgorithm[] = ["vqe", "qaoa", "grover", "shor", "bell", "qft"]
  const lower = (raw ?? "").toLowerCase().trim() as SupportedAlgorithm
  return supported.includes(lower) ? lower : "vqe"
}

function recommendShots(p: DataProfile): number {
  // Shot count scales with complexity AND data scale tier
  const scaleBonus: Record<string, number> = { small: 0, medium: 512, large: 1024, massive: 2048 }
  const bonus = scaleBonus[p.dataScale] ?? 0
  return Math.min(8192, Math.max(512, 512 + Math.round(p.complexity * 2048) + p.qubits * 32 + bonus))
}

function extractQubits(qasm: string): number {
  const total = [...qasm.matchAll(/qreg\s+\w+\[(\d+)\]/g)]
    .reduce((s, m) => s + parseInt(m[1], 10), 0)
  return total || 4
}

function countGates(qasm: string): number {
  return qasm.split("\n").filter((l) => {
    const s = l.trim()
    return (
      s.length > 0 &&
      !s.startsWith("OPENQASM") &&
      !s.startsWith("include") &&
      !s.startsWith("qreg") &&
      !s.startsWith("creg") &&
      !s.startsWith("//") &&
      !s.startsWith("measure")
    )
  }).length
}

function detectCircuitType(qasm: string): string {
  const q = qasm.toLowerCase()
  if (q.includes("rx(") && q.includes("rz("))  return "qaoa"
  if (q.includes("ry(") && q.includes("rz("))  return "vqe"
  if (q.includes("cu1"))                        return "shor"
  if (q.includes("rz(") && q.includes("h "))   return "grover"
  return "bell"
}

function parseQASMToGates(qasm: string): GateInfo[] {
  const gates: GateInfo[] = []
  for (const line of qasm.split("\n")) {
    const s = line.trim()
    if (!s || s.startsWith("//") || s.startsWith("OPENQASM") ||
        s.startsWith("include") || s.startsWith("qreg") ||
        s.startsWith("creg") || s.startsWith("measure")) continue

    const withAngle = s.match(/^(\w+)\(([^)]+)\)\s+(.*);/)
    const plain     = s.match(/^(\w+)\s+(.*);/)

    if (withAngle) {
      const [, type, angleStr, qStr] = withAngle
      gates.push({ type, angle: parseFloat(angleStr), qubits: parseQubitList(qStr) })
    } else if (plain) {
      const [, type, qStr] = plain
      gates.push({ type, qubits: parseQubitList(qStr) })
    }
  }
  return gates
}

function parseQubitList(str: string): number[] {
  return [...str.matchAll(/\[(\d+)\]/g)].map((m) => parseInt(m[1], 10))
}
