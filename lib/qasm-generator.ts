export interface CircuitData {
  qubits: number
  gates: Array<{ type: string; targets: number[]; control?: number }>
}

export function generateQASM2(data: CircuitData): string {
  const { qubits, gates } = data

  let qasm = `OPENQASM 2.0;\ninclude "qelib1.inc";\n\n`
  qasm += `qreg q[${qubits}];\n`
  qasm += `creg c[${qubits}];\n\n`

  gates.forEach((gate) => {
    switch (gate.type.toLowerCase()) {
      case "h":
        qasm += `h q[${gate.targets[0]}];\n`
        break
      case "x":
        qasm += `x q[${gate.targets[0]}];\n`
        break
      case "y":
        qasm += `y q[${gate.targets[0]}];\n`
        break
      case "z":
        qasm += `z q[${gate.targets[0]}];\n`
        break
      case "cx":
      case "cnot":
        qasm += `cx q[${gate.control}],q[${gate.targets[0]}];\n`
        break
      case "cz":
        qasm += `cz q[${gate.control}],q[${gate.targets[0]}];\n`
        break
      case "measure":
        gate.targets.forEach((t) => {
          qasm += `measure q[${t}] -> c[${t}];\n`
        })
        break
    }
  })

  return qasm
}

export function parseUploadedData(data: any): CircuitData {
  // Parse uploaded CSV/JSON to extract circuit structure
  // This is a mock implementation
  return {
    qubits: data.qubits || 4,
    gates: data.gates || [
      { type: "h", targets: [0, 1, 2, 3] },
      { type: "cx", targets: [3], control: 0 },
      { type: "cx", targets: [2], control: 1 },
      { type: "measure", targets: [0, 1, 2, 3] },
    ],
  }
}
