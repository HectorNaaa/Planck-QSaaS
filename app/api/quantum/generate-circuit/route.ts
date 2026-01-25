import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log("[v0] Generate circuit request:", body)
    const { algorithm, inputData, qubits, shots, errorMitigation } = body
    
    // Check for API key authentication
    const apiKey = request.headers.get("x-api-key")
    const supabase = await createServerClient()
    
    let userId: string | null = null
    
    if (apiKey) {
      // Authenticate via API key
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("api_key", apiKey)
        .single()
      
      if (!profile) {
        return NextResponse.json(
          { success: false, error: "Invalid API key" },
          { status: 401 }
        )
      }
      userId = profile.id
    } else {
      // Authenticate via session
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        return NextResponse.json(
          { success: false, error: "Unauthorized. Please provide an API key or authenticate." },
          { status: 401 }
        )
      }
      userId = user.id
    }

    const pythonScript = `
import sys
import json
from quantum_circuit_generator import QuantumCircuitGenerator

# Parse input
config = json.loads(sys.argv[1])
generator = QuantumCircuitGenerator(config)

# Generate circuit based on algorithm and data
circuit_data = generator.generate_circuit()

# Output QASM and metadata
print(json.dumps(circuit_data))
`

    // In production, execute the Python script with spawn/exec
    // For now, return a simulated response based on the algorithm
    const circuitData = await generateCircuitFromAlgorithm(algorithm, inputData, qubits)

    return NextResponse.json({
      success: true,
      qasm: circuitData.qasm,
      qubits: circuitData.qubits,
      depth: circuitData.depth,
      gateCount: circuitData.gates.length,
      gates: circuitData.gates,
      recommendedShots: 1024,
      metadata: circuitData.metadata,
    })
  } catch (error) {
    console.error("[v0] Circuit generation error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate circuit",
      },
      { status: 500 },
    )
  }
}

async function generateCircuitFromAlgorithm(algorithm: string, inputData: any, qubits: number) {
  const dataAnalysis = analyzeInputData(inputData)
  const adaptedQubits = Math.max(qubits, dataAnalysis.recommendedQubits)

  // Simulate calling the Python generator
  const algorithmGenerators: Record<string, any> = {
    Bell: {
      qasm: `OPENQASM 2.0;
include "qelib1.inc";

qreg q[2];
creg c[2];

h q[0];
cx q[0],q[1];
measure q[0] -> c[0];
measure q[1] -> c[1];`,
      qubits: 2,
      depth: 3,
      gates: [
        { type: "h", targets: [0] },
        { type: "cx", targets: [1], control: 0 },
        { type: "measure", targets: [0, 1] },
      ],
    },
    Grover: {
      qasm: generateGroverQASM(adaptedQubits, dataAnalysis),
      qubits: adaptedQubits,
      depth: Math.ceil(Math.sqrt(Math.pow(2, adaptedQubits))) * (dataAnalysis.complexity || 1),
      gates: generateGroverGates(adaptedQubits),
    },
    Shor: {
      qasm: generateShorQASM(adaptedQubits),
      qubits: adaptedQubits,
      depth: adaptedQubits * 3,
      gates: generateShorGates(adaptedQubits),
    },
    VQE: {
      qasm: generateVQEQASM(adaptedQubits, dataAnalysis),
      qubits: adaptedQubits,
      depth: 10 + Math.floor(dataAnalysis.features / 2),
      gates: generateVQEGates(adaptedQubits),
    },
    QAOA: {
      qasm: generateQAOAQASM(adaptedQubits, dataAnalysis),
      qubits: adaptedQubits,
      depth: 6 + dataAnalysis.layers,
      gates: generateQAOAGates(adaptedQubits),
    },
  }

  const circuit = algorithmGenerators[algorithm] || algorithmGenerators.Bell

  return {
    ...circuit,
    metadata: {
      algorithm,
      generatedAt: new Date().toISOString(),
      inputDataSize: dataAnalysis.size,
      dataFeatures: dataAnalysis.features,
      dataComplexity: dataAnalysis.complexity,
    },
  }
}

function analyzeInputData(inputData: any) {
  let size = 0
  let features = 1
  let complexity = 1
  let recommendedQubits = 2
  let layers = 0

  if (!inputData) {
    return { size, features, complexity, recommendedQubits, layers }
  }

  try {
    // Array data (1D or 2D)
    if (Array.isArray(inputData)) {
      size = inputData.length

      // Check if 2D array (matrix)
      if (Array.isArray(inputData[0])) {
        features = inputData[0].length
        size = inputData.length * features
        complexity = Math.ceil(Math.sqrt(features))
        layers = Math.min(3, Math.floor(features / 2))
      } else {
        // 1D array
        features = 1
        complexity = 1
        layers = 1
      }
    }
    // CSV data
    else if (typeof inputData === "object" && inputData.raw && inputData.type === "csv") {
      const rows = inputData.raw.split("\n").filter((r: string) => r.trim())
      size = rows.length - 1 // Exclude header

      if (rows.length > 0) {
        const cols = rows[0].split(",").length
        features = cols
        complexity = Math.ceil(Math.sqrt(cols))
        layers = Math.min(3, Math.floor(cols / 3))
      }
    }
    // JSON object
    else if (typeof inputData === "object") {
      const keys = Object.keys(inputData)
      size = keys.length
      features = size
      complexity = Math.ceil(Math.log2(size))
      layers = Math.min(2, Math.floor(size / 4))
    }

    // Calculate recommended qubits based on data size
    recommendedQubits = Math.max(2, Math.ceil(Math.log2(size || 4)))

    // Cap at reasonable maximum
    recommendedQubits = Math.min(recommendedQubits, 20)
  } catch (error) {
    console.error("[v0] Error analyzing input data:", error)
  }

  return {
    size,
    features,
    complexity,
    recommendedQubits,
    layers: Math.max(1, layers),
  }
}

function generateGroverQASM(qubits: number, dataAnalysis: any): string {
  const baseIterations = Math.ceil(Math.sqrt(Math.pow(2, qubits)))
  const iterations = Math.ceil(baseIterations * dataAnalysis.complexity)

  let qasm = `OPENQASM 2.0;\ninclude "qelib1.inc";\n\n`
  qasm += `qreg q[${qubits}];\ncreg c[${qubits}];\n\n`

  // Initialize superposition
  for (let i = 0; i < qubits; i++) {
    qasm += `h q[${i}];\n`
  }

  // Grover iterations adapted to data
  for (let iter = 0; iter < iterations; iter++) {
    // Oracle (marks target state)
    qasm += `\n// Oracle iteration ${iter + 1}\n`
    for (let i = 0; i < qubits - 1; i++) {
      qasm += `cx q[${i}],q[${qubits - 1}];\n`
    }

    // Diffusion operator
    qasm += `\n// Diffusion\n`
    for (let i = 0; i < qubits; i++) {
      qasm += `h q[${i}];\n`
    }
    for (let i = 0; i < qubits; i++) {
      qasm += `x q[${i}];\n`
    }
    for (let i = 0; i < qubits - 1; i++) {
      qasm += `cx q[${i}],q[${qubits - 1}];\n`
    }
    for (let i = 0; i < qubits; i++) {
      qasm += `x q[${i}];\n`
    }
    for (let i = 0; i < qubits; i++) {
      qasm += `h q[${i}];\n`
    }
  }

  // Measure
  qasm += `\n// Measurement\n`
  for (let i = 0; i < qubits; i++) {
    qasm += `measure q[${i}] -> c[${i}];\n`
  }

  return qasm
}

function generateGroverGates(qubits: number) {
  const gates = []
  for (let i = 0; i < qubits; i++) {
    gates.push({ type: "h", targets: [i] })
  }
  for (let i = 0; i < qubits - 1; i++) {
    gates.push({ type: "cx", targets: [qubits - 1], control: i })
  }
  for (let i = 0; i < qubits; i++) {
    gates.push({ type: "measure", targets: [i] })
  }
  return gates
}

function generateShorQASM(qubits: number): string {
  let qasm = `OPENQASM 2.0;\ninclude "qelib1.inc";\n\n`
  qasm += `qreg q[${qubits}];\ncreg c[${qubits}];\n\n`
  qasm += `// Shor's algorithm circuit\n`

  // QFT preparation
  for (let i = 0; i < qubits; i++) {
    qasm += `h q[${i}];\n`
  }

  // Modular exponentiation (simplified)
  for (let i = 0; i < qubits - 1; i++) {
    qasm += `cx q[${i}],q[${i + 1}];\n`
  }

  // Inverse QFT
  for (let i = Math.floor(qubits / 2) - 1; i >= 0; i--) {
    qasm += `swap q[${i}],q[${qubits - 1 - i}];\n`
  }

  for (let i = 0; i < qubits; i++) {
    qasm += `measure q[${i}] -> c[${i}];\n`
  }

  return qasm
}

function generateShorGates(qubits: number) {
  const gates = []
  for (let i = 0; i < qubits; i++) {
    gates.push({ type: "h", targets: [i] })
  }
  for (let i = 0; i < qubits - 1; i++) {
    gates.push({ type: "cx", targets: [i + 1], control: i })
  }
  return gates
}

function generateVQEQASM(qubits: number, dataAnalysis: any): string {
  let qasm = `OPENQASM 2.0;\ninclude "qelib1.inc";\n\n`
  qasm += `qreg q[${qubits}];\ncreg c[${qubits}];\n\n`
  qasm += `// VQE ansatz circuit\n`

  const layers = Math.max(2, Math.min(5, dataAnalysis.layers + 2))

  for (let layer = 0; layer < layers; layer++) {
    qasm += `\n// Layer ${layer + 1}\n`
    for (let i = 0; i < qubits; i++) {
      const angle = (Math.PI / layers) * (layer + 1) * dataAnalysis.complexity
      qasm += `ry(${angle.toFixed(4)}) q[${i}];\n`
    }
    for (let i = 0; i < qubits - 1; i++) {
      qasm += `cx q[${i}],q[${i + 1}];\n`
    }
  }

  for (let i = 0; i < qubits; i++) {
    qasm += `measure q[${i}] -> c[${i}];\n`
  }

  return qasm
}

function generateVQEGates(qubits: number) {
  const gates = []
  for (let i = 0; i < qubits; i++) {
    gates.push({ type: "ry", targets: [i], parameter: Math.random() * Math.PI })
  }
  for (let i = 0; i < qubits - 1; i++) {
    gates.push({ type: "cx", targets: [i + 1], control: i })
  }
  return gates
}

function generateQAOAQASM(qubits: number, dataAnalysis: any): string {
  let qasm = `OPENQASM 2.0;\ninclude "qelib1.inc";\n\n`
  qasm += `qreg q[${qubits}];\ncreg c[${qubits}];\n\n`
  qasm += `// QAOA circuit\n`

  // Initial superposition
  for (let i = 0; i < qubits; i++) {
    qasm += `h q[${i}];\n`
  }

  const p = Math.max(2, Math.min(4, dataAnalysis.layers))

  for (let layer = 0; layer < p; layer++) {
    qasm += `\n// QAOA layer ${layer + 1}\n`
    // Problem Hamiltonian
    for (let i = 0; i < qubits - 1; i++) {
      qasm += `cx q[${i}],q[${i + 1}];\n`
      const gamma = (Math.PI / (2 * p)) * (layer + 1)
      qasm += `rz(${gamma.toFixed(4)}) q[${i + 1}];\n`
      qasm += `cx q[${i}],q[${i + 1}];\n`
    }
    // Mixer Hamiltonian
    for (let i = 0; i < qubits; i++) {
      const beta = (Math.PI / p) * (layer + 1)
      qasm += `rx(${beta.toFixed(4)}) q[${i}];\n`
    }
  }

  for (let i = 0; i < qubits; i++) {
    qasm += `measure q[${i}] -> c[${i}];\n`
  }

  return qasm
}

function generateQAOAGates(qubits: number) {
  const gates = []
  for (let i = 0; i < qubits; i++) {
    gates.push({ type: "h", targets: [i] })
  }
  for (let i = 0; i < qubits - 1; i++) {
    gates.push({ type: "cx", targets: [i + 1], control: i })
    gates.push({ type: "rz", targets: [i + 1], parameter: Math.random() })
  }
  return gates
}
