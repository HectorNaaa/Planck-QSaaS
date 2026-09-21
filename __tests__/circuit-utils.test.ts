import { describe, it, expect } from 'vitest'
import {
  calculateAdaptiveShots,
  extractQubitCount,
  selectAutoErrorMitigation
} from '@/lib/circuit-utils'

describe('calculateAdaptiveShots', () => {
  it('calculates representative values for qubits with no depth/gate bonus', () => {
    expect(calculateAdaptiveShots(4, 0, 0)).toBe(512)
    expect(calculateAdaptiveShots(8, 0, 0)).toBe(813)
    expect(calculateAdaptiveShots(10, 0, 0)).toBe(1024)
    expect(calculateAdaptiveShots(12, 0, 0)).toBe(1290)
    expect(calculateAdaptiveShots(16, 0, 0)).toBe(2048)
  })

  it('adds depth bonus correctly', () => {
    // 128 per 15 gate-layers
    expect(calculateAdaptiveShots(4, 15, 0)).toBe(512 + 128)
    expect(calculateAdaptiveShots(4, 30, 0)).toBe(512 + 256)
    // Floor division check
    expect(calculateAdaptiveShots(4, 14, 0)).toBe(512)
    expect(calculateAdaptiveShots(4, 29, 0)).toBe(512 + 128)
  })

  it('adds gate bonus correctly', () => {
    // 64 per 25 gates
    expect(calculateAdaptiveShots(4, 0, 25)).toBe(512 + 64)
    expect(calculateAdaptiveShots(4, 0, 50)).toBe(512 + 128)
    // Floor division check
    expect(calculateAdaptiveShots(4, 0, 24)).toBe(512)
    expect(calculateAdaptiveShots(4, 0, 49)).toBe(512 + 64)
  })

  it('combines depth and gate bonuses', () => {
    expect(calculateAdaptiveShots(4, 15, 25)).toBe(512 + 128 + 64)
    expect(calculateAdaptiveShots(10, 30, 75)).toBe(1024 + 256 + 192)
  })

  it('clamps to lower bound of 512', () => {
    // Even if qubits < 4, minimum is 512
    expect(calculateAdaptiveShots(2, 0, 0)).toBe(512)
    expect(calculateAdaptiveShots(1, 0, 0)).toBe(512)
  })

  it('clamps to upper bound of 8192', () => {
    // High qubits, depth, and gates
    expect(calculateAdaptiveShots(100, 1000, 10000)).toBe(8192)
    expect(calculateAdaptiveShots(50, 0, 0)).toBe(8192)
  })
})

describe('extractQubitCount', () => {
  it('extracts qubit count from qreg declaration', () => {
    const qasm = `
      OPENQASM 2.0;
      include "qelib1.inc";
      qreg q[5];
      creg c[5];
      h q[0];
    `
    expect(extractQubitCount(qasm)).toBe(5)
  })

  it('defaults to 4 if no qreg is found', () => {
    const qasm = `
      OPENQASM 2.0;
      include "qelib1.inc";
      h q[0];
    `
    expect(extractQubitCount(qasm)).toBe(4)
  })

  it('extracts qubit count with different spacing', () => {
    const qasm = 'qreg    my_qubits[12];'
    expect(extractQubitCount(qasm)).toBe(12)
  })
})

describe('selectAutoErrorMitigation', () => {
  it('selects low for complexity < 0.6', () => {
    expect(selectAutoErrorMitigation(4, 10, 20)).toBe('low')
  })

  it('selects medium for complexity >= 0.6 and < 1.5', () => {
    expect(selectAutoErrorMitigation(12, 10, 20)).toBe('medium')
    expect(selectAutoErrorMitigation(4, 50, 20)).toBe('medium')
    expect(selectAutoErrorMitigation(4, 10, 300)).toBe('medium')
  })

  it('selects high for complexity >= 1.5', () => {
    expect(selectAutoErrorMitigation(30, 10, 20)).toBe('high') // 30/20 = 1.5
    expect(selectAutoErrorMitigation(20, 50, 20)).toBe('high') // 1 + 0.5 = 1.5
    expect(selectAutoErrorMitigation(20, 0, 250)).toBe('high') // 1 + 0 + 0.5 = 1.5
    expect(selectAutoErrorMitigation(50, 200, 1000)).toBe('high')
  })
})
