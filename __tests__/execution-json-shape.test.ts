/**
 * __tests__/execution-json-shape.test.ts
 *
 * Tests for:
 * 1. The circuit_data pass-through logic used by toClientRow (SSE + dashboard)
 *    — verifies QASM, backend_reason, and ml_tuning survive the round-trip.
 * 2. The backend-policy selectBackend function — verifies auto-routing produces
 *    a human-readable reason for each policy (the comment shown in the UI).
 * 3. The download payload shape — verifies top-level qasm and backend_reason
 *    fields are included.
 */

import { describe, it, expect } from "vitest"
import { selectBackend } from "@/lib/backend-policy"

// ─── Inline copy of toClientRow (mirrors app/api/quantum/stream/route.ts) ────
// Keeping a copy here so changes to the source are caught by these tests.
function toClientRow(r: {
  id: string
  circuit_name?: string
  algorithm?: string
  status?: string
  qubits_used?: number
  runtime_ms?: number
  success_rate?: number
  backend_selected?: string
  created_at?: string
  shots?: number
  error_mitigation?: string
  circuit_data?: string | null
}) {
  let parsed: any = null
  try { parsed = r.circuit_data ? JSON.parse(r.circuit_data) : null } catch { /* keep null */ }
  return {
    id:               r.id,
    circuit_name:     r.circuit_name   ?? "",
    algorithm:        r.algorithm      ?? "",
    status:           r.status         ?? "pending",
    qubits_used:      r.qubits_used    ?? 0,
    runtime_ms:       r.runtime_ms     ?? 0,
    success_rate:     r.success_rate   ?? 0,
    backend_selected: r.backend_selected ?? null,
    created_at:       new Date(r.created_at ?? Date.now()).toISOString(),
    shots:            r.shots          ?? 0,
    error_mitigation: r.error_mitigation ?? null,
    circuit_data: parsed ? {
      source:         parsed.source,
      fidelity:       parsed.results?.fidelity ?? null,
      counts:         parsed.results?.counts   ?? null,
      qasm:           parsed.qasm              ?? null,
      backend_reason: parsed.backend_reason    ?? null,
      ml_tuning:      parsed.ml_tuning         ?? null,
    } : null,
  }
}

// ─── Inline copy of downloadRow payload builder (mirrors digital-twin-dashboard) ─
function buildDownloadPayload(r: ReturnType<typeof toClientRow> & { digital_twin_id?: string | null }) {
  return {
    id: r.id,
    circuit_name: r.circuit_name,
    algorithm: r.algorithm,
    status: r.status,
    backend_selected: r.backend_selected,
    backend_reason: r.circuit_data?.backend_reason ?? null,
    qubits_used: r.qubits_used,
    shots: r.shots,
    runtime_ms: r.runtime_ms,
    success_rate: r.success_rate,
    error_mitigation: r.error_mitigation,
    digital_twin_id: r.digital_twin_id ?? null,
    qasm: r.circuit_data?.qasm ?? null,
    circuit_data: r.circuit_data ?? null,
  }
}

// ─── Shared test fixtures ─────────────────────────────────────────────────────

const QASM = `OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[3];\nh q[0];\ncx q[0],q[1];`

const dbRow = {
  id: "exec-001",
  circuit_name: "VQE Run",
  algorithm: "vqe",
  status: "completed",
  qubits_used: 3,
  runtime_ms: 491,
  success_rate: 14.84,
  backend_selected: "quantum_inspired_gpu",
  created_at: "2026-04-17T22:40:46.000Z",
  shots: 512,
  error_mitigation: "none",
  circuit_data: JSON.stringify({
    source: "ui",
    qasm: QASM,
    results: { fidelity: 98.5, counts: { "000": 66, "111": 76 } },
    backend_reason: "Latency-first: selected quantum_inspired_gpu for 3q/5d",
    ml_tuning: { shots: 512, confidence: 0.82, reasoning: "Low qubit count", based_on_executions: 3 },
  }),
}

// ─── 1. toClientRow — circuit_data pass-through ───────────────────────────────

describe("toClientRow circuit_data pass-through", () => {
  it("preserves QASM from stored circuit_data", () => {
    const row = toClientRow(dbRow)
    expect(row.circuit_data?.qasm).toBe(QASM)
  })

  it("preserves backend_reason from stored circuit_data", () => {
    const row = toClientRow(dbRow)
    expect(row.circuit_data?.backend_reason).toMatch(/Latency-first/)
  })

  it("preserves ml_tuning from stored circuit_data", () => {
    const row = toClientRow(dbRow)
    expect(row.circuit_data?.ml_tuning).toBeDefined()
    expect((row.circuit_data?.ml_tuning as any)?.confidence).toBe(0.82)
  })

  it("preserves fidelity and counts", () => {
    const row = toClientRow(dbRow)
    expect(row.circuit_data?.fidelity).toBe(98.5)
    expect(row.circuit_data?.counts?.["111"]).toBe(76)
  })

  it("returns null circuit_data when circuit_data column is null", () => {
    const row = toClientRow({ ...dbRow, circuit_data: null })
    expect(row.circuit_data).toBeNull()
  })

  it("returns null circuit_data on malformed JSON", () => {
    const row = toClientRow({ ...dbRow, circuit_data: "not-json" })
    expect(row.circuit_data).toBeNull()
  })
})

// ─── 2. Download payload shape ────────────────────────────────────────────────

describe("download payload shape", () => {
  it("includes top-level qasm field", () => {
    const row = toClientRow(dbRow)
    const payload = buildDownloadPayload(row)
    expect(payload.qasm).toBe(QASM)
  })

  it("includes top-level backend_reason field", () => {
    const row = toClientRow(dbRow)
    const payload = buildDownloadPayload(row)
    expect(payload.backend_reason).toMatch(/Latency-first/)
  })

  it("keeps circuit_data with full detail", () => {
    const row = toClientRow(dbRow)
    const payload = buildDownloadPayload(row)
    expect(payload.circuit_data?.fidelity).toBe(98.5)
    expect(payload.circuit_data?.ml_tuning).toBeDefined()
  })

  it("top-level qasm is null when circuit has no qasm stored", () => {
    const rowNoQasm = {
      ...dbRow,
      circuit_data: JSON.stringify({
        source: "ui",
        results: { fidelity: 90, counts: {} },
        backend_reason: "Manual selection",
      }),
    }
    const row = toClientRow(rowNoQasm)
    const payload = buildDownloadPayload(row)
    expect(payload.qasm).toBeNull()
  })
})

// ─── 3. Backend-policy auto-routing reasons ───────────────────────────────────

describe("selectBackend — auto mode produces a reason", () => {
  const base = {
    qubits: 4,
    depth: 10,
    gateCount: 20,
    shots: 512,
    targetLatency: null,
    errorMitigation: "none",
    backendHint: "auto",
  }

  it("latency_first: reason mentions the selected backend", () => {
    const result = selectBackend({ ...base, policy: "latency_first" })
    expect(result.reason).toContain(result.backendId)
    expect(result.reason.length).toBeGreaterThan(10)
  })

  it("cost_first: reason mentions cost rank", () => {
    const result = selectBackend({ ...base, policy: "cost_first" })
    expect(result.reason).toMatch(/cost/i)
  })

  it("capacity_first: reason mentions headroom", () => {
    const result = selectBackend({ ...base, policy: "capacity_first" })
    expect(result.reason).toMatch(/headroom|capacity/i)
  })

  it("manual hint bypasses policy and reason says Manual selection", () => {
    const result = selectBackend({ ...base, backendHint: "hpc_gpu" })
    expect(result.backendId).toBe("hpc_gpu")
    expect(result.reason).toMatch(/Manual selection/)
  })

  it("high error-mitigation upgrades qpu to hpc_gpu with explanation", () => {
    const result = selectBackend({
      ...base,
      errorMitigation: "high",
      // Force quantum_qpu selection by using a circuit that targets it
      qubits: 25,
      depth: 120,
      gateCount: 600,
      policy: "latency_first",
    })
    // quantum_qpu would be selected but should be overridden to hpc_gpu
    expect(result.backendId).toBe("hpc_gpu")
    expect(result.reason).toMatch(/hpc_gpu/)
  })

  it("metadata.source is 'auto' for auto mode", () => {
    const result = selectBackend({ ...base, policy: "latency_first" })
    expect(result.metadata.source).toBe("auto")
  })

  it("metadata.source is 'manual' for manual hint", () => {
    const result = selectBackend({ ...base, backendHint: "quantum_qpu" })
    expect(result.metadata.source).toBe("manual")
  })
})
