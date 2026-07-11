import { describe, it, expect } from 'vitest'
import { transpileWithQuark } from '@/lib/qasm-processor'

describe('transpileWithQuark', () => {
  it('cancels adjacent identical self-inverse gates in QASM', async () => {
    const qasm = `OPENQASM 2.0;
include "qelib1.inc";
qreg q[2];
creg c[2];
x q[0];
x q[0];
measure q[0] -> c[0];`
    
    const result = await transpileWithQuark(qasm)
    expect(result.used).toBe(true)
    expect(result.qasm).toContain('OPENQASM')
    expect(result.qasm).not.toContain('x q[0];')
  })

  it('cancels self-inverse gates commuting past other gates', async () => {
    const qasm = `OPENQASM 2.0;
include "qelib1.inc";
qreg q[2];
creg c[2];
x q[0];
z q[1];
x q[0];
measure q[0] -> c[0];`
    
    const result = await transpileWithQuark(qasm)
    expect(result.used).toBe(true)
    expect(result.qasm).toContain('z q[1];')
    expect(result.qasm).not.toContain('x q[0];')
  })
})
