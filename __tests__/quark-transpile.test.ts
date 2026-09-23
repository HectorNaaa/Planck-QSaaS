import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { transpileWithQuark, transpileCircuitPipeline } from '@/lib/qasm-processor'

/** Whether the Quark compiler's real dependency (networkx) is importable in this environment. */
function quarkDependencyAvailable(): boolean {
  try {
    execFileSync('python', ['-c', 'import networkx'], { stdio: 'ignore' })
    return true
  } catch {
    try {
      execFileSync('python3', ['-c', 'import networkx'], { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  }
}

const QUARK_AVAILABLE = quarkDependencyAvailable()

describe('transpileWithQuark', () => {
  it.runIf(QUARK_AVAILABLE)('cancels adjacent identical self-inverse gates in QASM', async () => {
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

  it.runIf(QUARK_AVAILABLE)('cancels self-inverse gates commuting past other gates', async () => {
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

  // These run regardless of whether `networkx` is installed here — they pin down the
  // honesty contract itself, not the optimization quality.
  it('never reports used:true when Quark could not actually run (no silent fake success)', async () => {
    const qasm = `OPENQASM 2.0;
include "qelib1.inc";
qreg q[2];
creg c[2];
x q[0];
x q[0];
measure q[0] -> c[0];`

    const result = await transpileWithQuark(qasm)
    if (QUARK_AVAILABLE) {
      expect(result.used).toBe(true)
    } else {
      // Quark's dependency is unavailable in this environment: the adapter must
      // fall back to the original QASM untouched and honestly report used:false
      // — never claim success for a circuit it never touched.
      expect(result.used).toBe(false)
      expect(result.qasm).toBe(qasm)
    }
  })

  it('transpileCircuitPipeline skips the Quark stage entirely when { quark: false }', async () => {
    const qasm = `OPENQASM 2.0;
include "qelib1.inc";
qreg q[2];
creg c[2];
x q[0];
x q[0];
measure q[0] -> c[0];`

    const result = await transpileCircuitPipeline(qasm, { quark: false })
    expect(result.quarkApplied).toBe(false)
  })
})

