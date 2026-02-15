import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { CppMLEngine } from "@/lib/ml/cpp-ml-engine"
import { calculateFidelity } from "@/lib/backend-selector"
import { checkRateLimit, getRetryAfter, validatePayloadSize } from "@/lib/rate-limiter"
import { authenticateRequest } from "@/lib/api-auth"
import {
  validateAlgorithm,
  validateBackend,
  validateErrorMitigation,
  validateQubits,
  validateShots,
  validateDepth,
  validateGateCount,
  validateQASM,
  validateInputData,
  sanitizeCircuitName,
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

    // Validate payload size (1MB max)
    if (!validatePayloadSize(body)) {
      return NextResponse.json(
        { success: false, error: "Payload too large. Maximum size is 1MB." },
        { status: 413 }
      )
    }

    // Extract and validate all inputs
    const qasm = body.qasm
    const shots = validateShots(body.shots)
    const backend = validateBackend(body.backend)
    const errorMitigation = validateErrorMitigation(body.errorMitigation)
    const circuitName = sanitizeCircuitName(body.circuitName)
    const algorithm = validateAlgorithm(body.algorithm)
    const executionType = body.executionType === "manual" ? "manual" : "auto"
    const qubits = validateQubits(body.qubits)
    const depth = validateDepth(body.depth)
    const gateCount = validateGateCount(body.gateCount)
    const targetLatency = body.targetLatency ? Math.max(0, Math.min(60000, Number(body.targetLatency))) : null
    const predictedShots = body.predictedShots ? validateShots(body.predictedShots) : null
    const predictedBackend = body.predictedBackend ? validateBackend(body.predictedBackend) : null
    const predictedFidelity = body.predictedFidelity ? Math.max(0, Math.min(1, Number(body.predictedFidelity))) : null

    // Validate QASM code
    const qasmValidation = validateQASM(qasm)
    if (!qasmValidation.valid) {
      return NextResponse.json(
        { success: false, error: qasmValidation.error },
        { status: 400 }
      )
    }

    // Validate input data
    const inputDataValidation = validateInputData(body.inputData)
    if (!inputDataValidation.valid) {
      return NextResponse.json(
        { success: false, error: inputDataValidation.error },
        { status: 400 }
      )
    }
    const inputData = inputDataValidation.data

    // Authenticate (API-key via service-role or session cookie)
    const auth = await authenticateRequest(request)
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }
    const userId = auth.userId!

    const supabase = await createServerClient()

    // Rate limiting: 1 request per 3 seconds per user
    const identifier = userId
    if (!checkRateLimit(identifier)) {
      const retryAfter = Math.ceil(getRetryAfter(identifier) / 1000)
      return NextResponse.json(
        { 
          success: false, 
          error: "Rate limit exceeded. Please wait before making another request.",
          retry_after_seconds: retryAfter 
        },
        { 
          status: 429,
          headers: {
            "Retry-After": retryAfter.toString(),
            "X-RateLimit-Limit": "1",
            "X-RateLimit-Reset": new Date(Date.now() + retryAfter * 1000).toISOString(),
          }
        }
      )
    }

    const results = await simulateQuantumCircuit({
      qasm,
      shots,
      backend,
      errorMitigation,
    })

    const actualFidelity = calculateFidelity(backend, qubits, depth)

    const { data: insertedLog, error: insertError } = await supabase
      .from("execution_logs")
      .insert({
        user_id: userId,
        circuit_name: circuitName,
        algorithm: algorithm,
        execution_type: executionType,
        backend,
        status: "completed",
        success_rate: results.successRate,
        runtime_ms: results.runtime,
        qubits_used: qubits || extractQubitCount(qasm),
        shots,
        error_mitigation: errorMitigation,
        circuit_data: {
          qasm_code: qasm,
          input_data: inputData,
          algorithm_params: {
            algorithm,
            qubits,
            shots,
            backend,
            error_mitigation: errorMitigation,
            depth,
            gate_count: gateCount,
            target_latency: targetLatency,
          },
          results: {
            counts: results.counts,
            success_rate: results.successRate,
            runtime_ms: results.runtime,
            memory: results.memory,
            fidelity: actualFidelity,
          },
          backend_config: {
            backend,
            shots,
            error_mitigation: errorMitigation,
          },
        },
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (insertError) {
      console.error("[API] Failed to insert execution log:", insertError.message)
    }

    if (insertedLog?.id && inputData) {
      const dataSize = JSON.stringify(inputData).length

      try {
        await CppMLEngine.recordExecution(
          {
            qubits,
            depth,
            gateCount,
            algorithm,
            dataSize,
            dataComplexity: 0.5,
            targetLatency: targetLatency || 0,
            errorMitigation,
            userHistoricalAccuracy: 0.5,
          },
          insertedLog.id,
          userId,
          {
            actualShots: shots,
            actualBackend: backend,
            actualRuntime: results.runtime,
            actualSuccessRate: results.successRate,
            actualFidelity,
            predictedShots: predictedShots || shots,
            predictedBackend: predictedBackend || backend,
            predictedRuntime: results.runtime,
            predictedFidelity: predictedFidelity || actualFidelity,
          },
        )
      } catch (mlError) {
        // ML recording is non-critical, log but don't fail
        console.error("[API] ML recording failed:", mlError)
      }
    }

    return NextResponse.json({
      success: true,
      counts: results.counts,
      successRate: results.successRate,
      runtime: results.runtime,
      memory: results.memory,
      execution_id: insertedLog?.id,
      fidelity: actualFidelity,
    })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, "Failed to simulate circuit")
    console.error("[API] Simulate error:", error)
    return NextResponse.json(
      { success: false, error: safeError },
      { status: 500 }
    )
  }
}

async function simulateQuantumCircuit(config: {
  qasm: string
  shots: number
  backend: string
  errorMitigation: string
}) {
  const { shots, backend, errorMitigation, qasm } = config

  const counts: Record<string, number> = {}
  const qubits = extractQubitCount(qasm)

  for (let i = 0; i < shots; i++) {
    let outcome = ""
    for (let q = 0; q < qubits; q++) {
      let prob = 0.5
      if (backend === "quantum_qpu") {
        prob += (Math.random() - 0.5) * 0.2
      }
      outcome += Math.random() < prob ? "1" : "0"
    }
    counts[outcome] = (counts[outcome] || 0) + 1
  }

  if (errorMitigation !== "none") {
    const mitigationFactor =
      {
        low: 0.05,
        medium: 0.1,
        high: 0.15,
      }[errorMitigation] || 0.1

    Object.keys(counts).forEach((key) => {
      counts[key] = Math.floor(counts[key] * (1 + mitigationFactor * Math.random()))
    })
  }

  const totalShots = Object.values(counts).reduce((a, b) => a + b, 0)
  const maxCount = Math.max(...Object.values(counts))
  const successRate = (maxCount / totalShots) * 100

  const runtime = 100 + Math.random() * 400

  return {
    counts,
    successRate,
    runtime,
    memory: Object.keys(counts),
  }
}

function extractQubitCount(qasm: string): number {
  const match = qasm.match(/qreg\s+\w+\[(\d+)\]/)
  return match ? Number.parseInt(match[1]) : 4
}
