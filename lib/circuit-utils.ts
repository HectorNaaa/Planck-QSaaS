/**
 * circuit-utils.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared, pure helpers for circuit analysis. Imported by:
 *   - app/api/quantum/simulate/route.ts  (server-side)
 *   - app/qsaas/runner/page.tsx          (client-side via useCallback wrapper)
 *
 * No I/O, no side-effects — all functions are deterministic and unit-testable.
 */

// ── Qubit extraction ──────────────────────────────────────────────────────────

/**
 * Extract the qubit count declared in an OpenQASM 2.0 string.
 * Looks for `qreg q[N];` and returns N, defaulting to 4 if not found.
 */
export function extractQubitCount(qasm: string): number {
  const match = qasm.match(/qreg\s+\w+\[(\d+)\]/)
  return match ? parseInt(match[1], 10) : 4
}

// ── Adaptive shot count ───────────────────────────────────────────────────────

/**
 * Compute the recommended shot count for a circuit, scaling with complexity.
 *
 * Formula: exponential base grows with qubit count (~doubling every 6 qubits),
 * with additive bonuses for circuit depth and gate count.
 *   base ≈ 512 × 2^((qubits−4)/6)
 *   + 128 per 15 gate-layers of depth
 *   + 64  per 25 gates
 *
 * Representative values (no depth/gate bonus):
 *   4 q → 512 | 8 q → 813 | 10 q → 1 024 | 12 q → 1 290 | 16 q → 2 048
 *
 * Clamped to [512, 8192].
 */
export function calculateAdaptiveShots(qubits: number, depth: number, gateCount: number): number {
  const base = Math.round(512 * Math.pow(2, (qubits - 4) / 6))
  const depthBonus = Math.floor(depth / 15) * 128
  const gateBonus = Math.floor(gateCount / 25) * 64
  return Math.min(8192, Math.max(512, base + depthBonus + gateBonus))
}

// ── Error-mitigation heuristic ────────────────────────────────────────────────

/**
 * Select a complexity-appropriate error-mitigation level.
 * Used as a fallback when `errorMitigation === "auto"` and no ML data exists yet.
 *
 * Complexity score:
 *   (qubits/20) + (depth/100) + (gateCount/500)
 *   ≥ 1.5 → "high" | ≥ 0.6 → "medium" | else → "low"
 */
export function selectAutoErrorMitigation(qubits: number, depth: number, gateCount: number): string {
  const complexity = qubits / 20 + depth / 100 + gateCount / 500
  if (complexity >= 1.5) return "high"
  if (complexity >= 0.6) return "medium"
  return "low"
}
