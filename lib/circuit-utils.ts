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
 * Formula (mirrors the UI display in runner/page.tsx):
 *   base = 512
 *   + 256  per 5 qubits  (depth of Hilbert space grows exponentially)
 *   + 128  per 20 gate depth
 *   + 64   per 30 gates
 *
 * Clamped to [512, 8192].
 */
export function calculateAdaptiveShots(qubits: number, depth: number, gateCount: number): number {
  const base = 512
  const qubitBonus = Math.floor(qubits / 5) * 256
  const depthBonus = Math.floor(depth / 20) * 128
  const gateBonus = Math.floor(gateCount / 30) * 64
  return Math.min(8192, Math.max(512, base + qubitBonus + depthBonus + gateBonus))
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
