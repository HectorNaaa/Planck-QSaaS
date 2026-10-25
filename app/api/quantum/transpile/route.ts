import { type NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import {
  validateQubits,
  validateQASM,
  createSafeErrorResponse,
  validateRequestHeaders,
} from "@/lib/security"
import { transpileCircuitPipeline, analyzeCircuit } from "@/lib/qasm-processor"

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
    
    // Authenticate (API-key via service-role or session cookie)
    const auth = await authenticateRequest(request)
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    const transpilerConfig = {
      qasm,
      qubits,
    }

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

async function transpileCircuit(config: { qasm: string; qubits: number }) {
  const { qasm } = await transpileCircuitPipeline(config.qasm)

  // Count the actual SWAP gates in the optimized QASM
  const swapCount = (qasm.match(/\bswap\b/g) || []).length
  const stats = analyzeCircuit(qasm)

  return {
    qasm,
    swapCount,
    qubitMapping: Array.from({ length: config.qubits }, (_, i) => i),
    depth: stats.depth,
  }
}
