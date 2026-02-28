/**
 * qasm-processor.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-side quantum circuit façade. Delegates QASM generation entirely to
 * lib/circuit-builder.ts (data-driven, parametric) and optionally pipes the
 * result through the compiled C++ transpiler (scripts/transpile_circuit.cpp)
 * for gate fusion and CX cancellation. Falls back to pure-TS if binary absent.
 *
 * Public API — named exports usable directly without instantiating the class:
 *   generateCircuit(algorithm, data)  → Promise<QuantumCircuit>
 *   analyzeCircuit(qasm)              → CircuitStats
 *   transpileWithCpp(qasm)            → Promise<{ qasm, used }>
 *
 * Class API (backwards-compatible):
 *   QASMProcessor.generateCircuit / QASMProcessor.analyzeCircuit
 */

import { execFile } from "child_process"
import { promisify } from "util"
import { existsSync } from "fs"
import { join } from "path"
import {
  analyzeInputData,
  buildCircuit,
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
}

export interface CircuitStats {
  qubits: number
  depth: number
  gateCount: number
  circuitType: string
}

// ─── C++ transpiler ────────────────────────────────────────────────────────────

const CPP_BINARY    = join(process.cwd(), "scripts", "transpile_circuit")
const CPP_AVAILABLE = existsSync(CPP_BINARY)

/**
 * Pipe QASM through the compiled C++ gate-optimiser when available.
 * Returns the original string unchanged if the binary is absent or errors.
 */
export async function transpileWithCpp(
  qasm: string,
): Promise<{ qasm: string; used: boolean }> {
  if (!CPP_AVAILABLE) return { qasm, used: false }
  try {
    const { stdout } = await execFileAsync(CPP_BINARY, [], {
      input: qasm,
      timeout: 5_000,
      maxBuffer: 1024 * 1024,
    } as any)
    return { qasm: stdout.trim(), used: true }
  } catch {
    return { qasm, used: false }
  }
}

// ─── Core functions ────────────────────────────────────────────────────────────

/**
 * Build a parametric circuit from uploaded data, then optimise via C++ if
 * available. All register sizes and rotation angles are derived from the data
 * profile — nothing is hardcoded.
 */
export async function generateCircuit(
  algorithm: string,
  data: unknown,
): Promise<QuantumCircuit> {
  const algo    = sanitizeAlgorithm(algorithm)
  const profile: DataProfile = analyzeInputData(data)
  const built   = buildCircuit(algo, profile)

  const { qasm, used } = await transpileWithCpp(built.qasm)

  return {
    qasm,
    qubits:            built.qubits,
    depth:             built.depth,
    gates:             parseQASMToGates(qasm),
    recommended_shots: recommendShots(profile),
    gate_count:        built.gateCount,
    algorithm:         algo,
    paramSummary:      built.paramSummary,
    transpiled:        used,
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
  const supported: SupportedAlgorithm[] = ["vqe", "qaoa", "grover", "shor", "bell"]
  const lower = (raw ?? "").toLowerCase().trim() as SupportedAlgorithm
  return supported.includes(lower) ? lower : "vqe"
}

function recommendShots(p: DataProfile): number {
  return Math.min(8192, Math.max(512, 512 + Math.round(p.complexity * 2048) + p.qubits * 32))
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
