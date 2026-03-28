/**
 * backend-selector.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Low-level backend selection primitives. Pure functions — no I/O.
 *
 * Decision thresholds (can be tuned here without touching policy logic):
 *   < 12 qubits & depth < 50  → quantum_inspired_gpu  (fastest, cheapest)
 *   12–19 qubits, gates < 100 → quantum_qpu            (highest fidelity)
 *   ≥ 20 qubits | depth ≥ 100 → hpc_gpu               (best throughput)
 *
 * See backend-policy.ts for the higher-level policy wrapper (latency_first,
 * cost_first, capacity_first) that most callers should use instead.
 */
export type Backend = "quantum_inspired_gpu" | "hpc_gpu" | "quantum_qpu"

export interface CircuitMetrics {
  qubits: number
  depth: number
  gateCount: number
}

export function selectOptimalBackend(metrics: CircuitMetrics): Backend {
  const { qubits, depth, gateCount } = metrics

  // Quantum-inspired GPU: < 12 qubits and low depth
  if (qubits < 12 && depth < 50) {
    return "quantum_inspired_gpu"
  }

  // Quantum QPU: More qubits but not too many gates
  if (qubits >= 12 && qubits < 20 && gateCount < 100) {
    return "quantum_qpu"
  }

  // HPC GPU: Many qubits and high depth/complexity
  if (qubits >= 20 || depth >= 100 || gateCount >= 100) {
    return "hpc_gpu"
  }

  // Default to quantum-inspired GPU
  return "quantum_inspired_gpu"
}

export function selectBackendWithLatency(
  metrics: CircuitMetrics,
  targetLatency: number | null,
  preferredBackend: Backend,
): Backend {
  // Quantum QPU requires >= 500ms; downgrade to HPC if target is tighter.
  if (preferredBackend === "quantum_qpu" && targetLatency !== null && targetLatency < 500) {
    return "hpc_gpu"
  }

  // If no latency constraint, use optimal backend selection
  if (targetLatency === null) {
    return selectOptimalBackend(metrics)
  }

  // Select backend based on latency requirements
  const { qubits, depth } = metrics

  // Quantum-inspired GPU: fastest, best for < 100ms
  if (targetLatency < 100 && qubits < 12) {
    return "quantum_inspired_gpu"
  }

  // HPC GPU: moderate speed, good for 100-500ms
  if (targetLatency >= 100 && targetLatency < 500) {
    return "hpc_gpu"
  }

  // Quantum QPU: slowest but highest fidelity, requires >= 500ms
  if (targetLatency >= 500 && qubits >= 12) {
    return "quantum_qpu"
  }

  // Default fallback
  return selectOptimalBackend(metrics)
}

export function calculateFidelity(backend: Backend, qubits: number, depth: number): number {
  // Fidelity formula: base_fidelity * (1 - error_rate)^(depth)
  const baseFidelities = {
    quantum_inspired_gpu: 0.995,
    hpc_gpu: 0.998,
    quantum_qpu: 0.985,
  }

  const errorRates = {
    quantum_inspired_gpu: 0.001,
    hpc_gpu: 0.0005,
    quantum_qpu: 0.002,
  }

  const baseFidelity = baseFidelities[backend]
  const errorRate = errorRates[backend]

  return baseFidelity * Math.pow(1 - errorRate, depth) * 100
}

export function estimateRuntime(classicalComplexity: number, useQuantum: boolean): number {
  // Classical runtime grows linearly, quantum as sqrt(N)
  const baseTime = 0.1 // seconds

  if (useQuantum) {
    return baseTime * Math.sqrt(classicalComplexity)
  } else {
    return baseTime * classicalComplexity
  }
}
