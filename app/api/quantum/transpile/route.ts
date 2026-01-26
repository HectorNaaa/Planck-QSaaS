import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import {
  validateApiKey,
  validateBackend,
  validateQubits,
  validateQASM,
  createSafeErrorResponse,
  validateRequestHeaders,
} from "@/lib/security"

export async function POST(request: NextRequest) {
  try {
    // Validate request headers
    const headerValidation = validateRequestHeaders(request.headers)
    if (!headerValidation.valid) {
      return NextResponse.json(
        { success: false, error: headerValidation.error },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Validate inputs
    const backend = validateBackend(body.backend) || "quantum_qpu"
    const qubits = validateQubits(body.qubits)
    
    // Validate QASM
    const qasmValidation = validateQASM(body.qasm)
    if (!qasmValidation.valid) {
      return NextResponse.json(
        { success: false, error: qasmValidation.error },
        { status: 400 }
      )
    }
    const qasm = body.qasm
    
    // Authenticate via API key or session
    const apiKey = request.headers.get("x-api-key")
    const supabase = await createServerClient()
    
    if (apiKey) {
      // Validate API key format
      if (!validateApiKey(apiKey)) {
        return NextResponse.json(
          { success: false, error: "Invalid API key format" },
          { status: 401 }
        )
      }
      
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("api_key", apiKey)
        .single()
      
      if (profileError || !profile) {
        return NextResponse.json(
          { success: false, error: "Invalid API key" },
          { status: 401 }
        )
      }
    } else {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        return NextResponse.json(
          { success: false, error: "Unauthorized. Please provide an API key or authenticate." },
          { status: 401 }
        )
      }
    }

    const transpilerConfig = {
      qasm,
      backend,
      qubits,
      topology: getTopologyForBackend(backend),
    }

    // Simulate transpilation (in production, this would call the C++ transpiler)
    const transpiledCircuit = await transpileCircuit(transpilerConfig)

    return NextResponse.json({
      success: true,
      transpiledQASM: transpiledCircuit.qasm,
      swapCount: transpiledCircuit.swapCount,
      mappedQubits: transpiledCircuit.qubitMapping,
      depth: transpiledCircuit.depth,
    })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, "Failed to transpile circuit")
    console.error("[API] Transpilation error:", error)
    return NextResponse.json(
      { success: false, error: safeError },
      { status: 500 }
    )
  }
}

function getTopologyForBackend(backend: string) {
  const topologies: Record<string, any> = {
    quantum_qpu: {
      name: "IBM Falcon",
      connectivity: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [1, 4],
      ],
      qubits: 5,
    },
    hpc_gpu: {
      name: "Fully Connected",
      connectivity: "all-to-all",
      qubits: 30,
    },
    quantum_inspired_gpu: {
      name: "Fully Connected",
      connectivity: "all-to-all",
      qubits: 20,
    },
  }
  return topologies[backend] || topologies.quantum_inspired_gpu
}

async function transpileCircuit(config: {
  qasm: string
  backend: string
  qubits: number
  topology: any
}) {
  // Simulate transpilation logic
  const swapCount = config.backend === "quantum_qpu" ? Math.floor(Math.random() * 5) : 0

  return {
    qasm: config.qasm, // Would be modified QASM with SWAP gates inserted
    swapCount,
    qubitMapping: Array.from({ length: config.qubits }, (_, i) => i),
    depth: config.qasm.split("\n").length + swapCount,
  }
}
