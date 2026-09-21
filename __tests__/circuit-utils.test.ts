import { describe, it, expect } from 'vitest';
import { extractQubitCount } from '../lib/circuit-utils';

describe('extractQubitCount', () => {
  it('should extract the correct qubit count from a standard qreg declaration', () => {
    const qasm = `
      OPENQASM 2.0;
      include "qelib1.inc";
      qreg q[5];
      creg c[5];
    `;
    expect(extractQubitCount(qasm)).toBe(5);
  });

  it('should handle different register names', () => {
    const qasm = `qreg my_qubits[12];`;
    expect(extractQubitCount(qasm)).toBe(12);
  });

  it('should handle extra whitespace', () => {
    const qasm = `qreg    q[8]  ;`;
    expect(extractQubitCount(qasm)).toBe(8);
  });

  it('should return default (4) if no qreg declaration is found', () => {
    const qasm = `
      OPENQASM 2.0;
      include "qelib1.inc";
    `;
    expect(extractQubitCount(qasm)).toBe(4);
  });

  it('should return default (4) for empty string', () => {
    expect(extractQubitCount('')).toBe(4);
  });

  it('should extract the first qreg if multiple are present', () => {
    const qasm = `
      qreg q1[3];
      qreg q2[5];
    `;
    // Note: The current implementation uses match which finds the first occurrence
    expect(extractQubitCount(qasm)).toBe(3);
  });
});
