import { describe, it, expect } from 'vitest'
import {
  selectOptimalBackend,
  selectBackendWithLatency,
  calculateFidelity,
  estimateRuntime,
  type Backend,
  type CircuitMetrics,
} from '@/lib/backend-selector'

describe('selectOptimalBackend', () => {
  it('returns quantum_inspired_gpu for < 12 qubits and < 50 depth', () => {
    const metrics: CircuitMetrics = { qubits: 8, depth: 30, gateCount: 20 }
    expect(selectOptimalBackend(metrics)).toBe('quantum_inspired_gpu')
  })

  it('returns quantum_qpu for 12-19 qubits and < 100 gates', () => {
    const metrics: CircuitMetrics = { qubits: 15, depth: 60, gateCount: 50 }
    expect(selectOptimalBackend(metrics)).toBe('quantum_qpu')
  })

  it('returns hpc_gpu for >= 20 qubits', () => {
    const metrics: CircuitMetrics = { qubits: 25, depth: 30, gateCount: 20 }
    expect(selectOptimalBackend(metrics)).toBe('hpc_gpu')
  })

  it('returns hpc_gpu for depth >= 100', () => {
    const metrics: CircuitMetrics = { qubits: 10, depth: 100, gateCount: 20 }
    expect(selectOptimalBackend(metrics)).toBe('hpc_gpu')
  })

  it('returns hpc_gpu for gateCount >= 100 combined with high qubits/depth', () => {
    const metrics: CircuitMetrics = { qubits: 20, depth: 30, gateCount: 100 }
    expect(selectOptimalBackend(metrics)).toBe('hpc_gpu')
  })

  it('defaults to quantum_inspired_gpu for edge cases', () => {
    const metrics: CircuitMetrics = { qubits: 11, depth: 49, gateCount: 99 }
    expect(selectOptimalBackend(metrics)).toBe('quantum_inspired_gpu')
  })

  it('returns quantum_inspired_gpu via default fallback when no condition matches', () => {
    const metrics: CircuitMetrics = { qubits: 11, depth: 60, gateCount: 50 }
    expect(selectOptimalBackend(metrics)).toBe('quantum_inspired_gpu')
  })
})

describe('selectBackendWithLatency', () => {
  const baseMetrics: CircuitMetrics = { qubits: 15, depth: 30, gateCount: 40 }

  it('downgrades quantum_qpu to hpc_gpu when targetLatency < 500ms', () => {
    const result = selectBackendWithLatency(
      baseMetrics,
      300,
      'quantum_qpu'
    )
    expect(result).toBe('hpc_gpu')
  })

  it('returns preferred backend when targetLatency is null', () => {
    const result = selectBackendWithLatency(
      { qubits: 8, depth: 20, gateCount: 10 },
      null,
      'quantum_inspired_gpu'
    )
    expect(result).toBe('quantum_inspired_gpu')
  })

  it('selects quantum_inspired_gpu for targetLatency < 100ms and qubits < 12', () => {
    const result = selectBackendWithLatency(
      { qubits: 8, depth: 20, gateCount: 10 },
      50,
      'quantum_inspired_gpu'
    )
    expect(result).toBe('quantum_inspired_gpu')
  })

  it('selects hpc_gpu for targetLatency 100-499ms', () => {
    const result = selectBackendWithLatency(
      baseMetrics,
      250,
      'quantum_qpu'
    )
    expect(result).toBe('hpc_gpu')
  })

  it('selects quantum_qpu for targetLatency >= 500ms and qubits >= 12', () => {
    const result = selectBackendWithLatency(
      { qubits: 15, depth: 30, gateCount: 40 },
      600,
      'quantum_qpu'
    )
    expect(result).toBe('quantum_qpu')
  })

  it('falls back to optimal selection when conditions not met', () => {
    const result = selectBackendWithLatency(
      { qubits: 25, depth: 120, gateCount: 150 },
      200,
      'hpc_gpu'
    )
    expect(result).toBe('hpc_gpu')
  })
})

describe('calculateFidelity', () => {
  it('calculates fidelity for quantum_inspired_gpu', () => {
    const fidelity = calculateFidelity('quantum_inspired_gpu', 8, 20)
    expect(fidelity).toBeCloseTo(0.995 * Math.pow(0.999, 20) * 100, 2)
  })

  it('calculates fidelity for hpc_gpu', () => {
    const fidelity = calculateFidelity('hpc_gpu', 15, 50)
    expect(fidelity).toBeCloseTo(0.998 * Math.pow(0.9995, 50) * 100, 2)
  })

  it('calculates fidelity for quantum_qpu', () => {
    const fidelity = calculateFidelity('quantum_qpu', 12, 100)
    expect(fidelity).toBeCloseTo(0.985 * Math.pow(0.998, 100) * 100, 2)
  })

  it('returns lower fidelity for deeper circuits', () => {
    const shallow = calculateFidelity('quantum_qpu', 12, 10)
    const deep = calculateFidelity('quantum_qpu', 12, 100)
    expect(deep).toBeLessThan(shallow)
  })
})

describe('estimateRuntime', () => {
  it('calculates linear runtime for classical computation', () => {
    const runtime = estimateRuntime(100, false)
    expect(runtime).toBe(0.1 * 100)
  })

  it('calculates sqrt runtime for quantum computation', () => {
    const runtime = estimateRuntime(100, true)
    expect(runtime).toBe(0.1 * Math.sqrt(100))
  })

  it('returns faster quantum for large problems', () => {
    const classical = estimateRuntime(10000, false)
    const quantum = estimateRuntime(10000, true)
    expect(quantum).toBeLessThan(classical)
  })

  it('selectBackendWithLatency falls back to optimal when no condition matches', () => {
    const result = selectBackendWithLatency(
      { qubits: 5, depth: 10, gateCount: 5 },
      1000,
      'hpc_gpu'
    )
    expect(result).toBe('quantum_inspired_gpu')
  })
})