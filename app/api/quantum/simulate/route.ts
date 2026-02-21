import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { getAdminClient } from "@/lib/supabase/admin"
import { CppMLEngine } from "@/lib/ml/cpp-ml-engine"
import { calculateFidelity } from "@/lib/backend-selector"
import { selectBackend } from "@/lib/backend-policy"
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
    // Tag origin: SDK requests send X-Planck-SDK header
    const source = request.headers.get("x-planck-sdk") ? "sdk" : "ui"
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

    // Use admin client for SDK (api_key) requests to bypass RLS,
    // session client for browser requests that already pass RLS.
    const supabase = auth.method === "api_key"
      ? getAdminClient()
      : await createServerClient()

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

    // ── Resolve qubits & circuit features ─────────────────────────
    const resolvedQubits = qubits || extractQubitCount(qasm)
    const resolvedDepth = depth || 1
    const resolvedGateCount = gateCount || 1
    const dataSize = inputData ? JSON.stringify(inputData).length : 0

    // ── ML-driven auto-tuning (shots + error mitigation) ────────
    // When executionType is "auto" we consult the RL engine first,
    // which uses the mega-table of all users' historical outcomes.
    let mlRecommendation: { recommendedShots: number; recommendedErrorMitigation: string; recommendedBackend: string; confidence: number; reasoning: string; basedOnExecutions: number } | null = null

    if (executionType === "auto") {
      try {
        mlRecommendation = await CppMLEngine.getRecommendation({
          qubits: resolvedQubits,
          depth: resolvedDepth,
          gateCount: resolvedGateCount,
          algorithm,
          dataSize,
          dataComplexity: 0.5,
          targetLatency: targetLatency || 0,
          errorMitigation: errorMitigation === "auto" ? "medium" : errorMitigation,
          userHistoricalAccuracy: 0.5,
        })
      } catch {
        // ML is non-critical
      }
    }

    // Resolve shots: ML recommendation > adaptive heuristic > user-provided
    const effectiveShots =
      (executionType === "auto" && mlRecommendation && mlRecommendation.basedOnExecutions > 0)
        ? mlRecommendation.recommendedShots
        : (executionType === "auto" && (!shots || shots === 1024))
          ? calculateAdaptiveShots(resolvedQubits, resolvedDepth, resolvedGateCount)
          : shots

    // Resolve error mitigation: ML recommendation > complexity heuristic > user-provided
    const effectiveErrorMitigation =
      (errorMitigation === "auto" && mlRecommendation && mlRecommendation.basedOnExecutions > 0)
        ? mlRecommendation.recommendedErrorMitigation
        : errorMitigation === "auto"
          ? selectAutoErrorMitigation(resolvedQubits, resolvedDepth, resolvedGateCount)
          : errorMitigation

    // ── Backend policy selection ───────────────────────────────────
    const policyResult = selectBackend({
      qubits: resolvedQubits,
      depth: resolvedDepth,
      gateCount: resolvedGateCount,
      shots: effectiveShots,
      targetLatency,
      errorMitigation: effectiveErrorMitigation,
      backendHint: backend,
    })
    const effectiveBackend = policyResult.backendId

    const results = await simulateQuantumCircuit({
      qasm,
      shots: effectiveShots,
      backend: effectiveBackend,
      errorMitigation: effectiveErrorMitigation,
    })

    const actualFidelity = calculateFidelity(effectiveBackend, resolvedQubits, depth)

    const { data: insertedLog, error: insertError } = await supabase
      .from("execution_logs")
      .insert({
        user_id: userId,
        circuit_name: circuitName,
        algorithm: algorithm,
        execution_type: executionType,
        backend: effectiveBackend,
        status: "completed",
        success_rate: results.successRate,
        runtime_ms: results.runtime,
        qubits_used: resolvedQubits,
        shots: effectiveShots,
        error_mitigation: effectiveErrorMitigation,
        // New backend-selection audit columns
        backend_selected: effectiveBackend,
        backend_reason: policyResult.reason,
        backend_hint: backend === "auto" ? null : backend,
        backend_metadata: policyResult.metadata,
        backend_assigned_at: new Date().toISOString(),
        circuit_data: {
          source,
          qasm_code: qasm,
          input_data: inputData,
          algorithm_params: {
            algorithm,
            qubits: resolvedQubits,
            shots: effectiveShots,
            backend: effectiveBackend,
            backend_hint: backend,
            error_mitigation: effectiveErrorMitigation,
            error_mitigation_requested: errorMitigation,
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
            backend: effectiveBackend,
            shots: effectiveShots,
            error_mitigation: effectiveErrorMitigation,
          },
          ml_recommendation: mlRecommendation ? {
            shots: mlRecommendation.recommendedShots,
            error_mitigation: mlRecommendation.recommendedErrorMitigation,
            confidence: mlRecommendation.confidence,
            based_on: mlRecommendation.basedOnExecutions,
          } : null,
        },
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (insertError) {
      console.error("[API] Failed to insert execution log:", insertError.message)
    }

    if (insertedLog?.id) {
      try {
        await CppMLEngine.recordExecution(
          {
            qubits: resolvedQubits,
            depth: resolvedDepth,
            gateCount: resolvedGateCount,
            algorithm,
            dataSize,
            dataComplexity: 0.5,
            targetLatency: targetLatency || 0,
            errorMitigation: effectiveErrorMitigation,
            userHistoricalAccuracy: 0.5,
          },
          insertedLog.id,
          userId,
          {
            actualShots: effectiveShots,
            actualBackend: effectiveBackend,
            actualRuntime: results.runtime,
            actualSuccessRate: results.successRate,
            actualFidelity,
            predictedShots: predictedShots || effectiveShots,
            predictedBackend: predictedBackend || effectiveBackend,
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
      total_shots: effectiveShots,
      error_mitigation: effectiveErrorMitigation,
      error_mitigation_requested: errorMitigation,
      execution_id: insertedLog?.id,
      fidelity: actualFidelity,
      backend: effectiveBackend,
      backendReason: policyResult.reason,
      backendHint: backend === "auto" ? null : backend,
      ml_tuning: mlRecommendation ? {
        shots: mlRecommendation.recommendedShots,
        error_mitigation: mlRecommendation.recommendedErrorMitigation,
        confidence: mlRecommendation.confidence,
        reasoning: mlRecommendation.reasoning,
        based_on_executions: mlRecommendation.basedOnExecutions,
      } : null,
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

/**
 * Select error mitigation level based on circuit complexity (heuristic fallback).
 * Used when errorMitigation === "auto" and no ML data is available yet.
 */
function selectAutoErrorMitigation(qubits: number, depth: number, gateCount: number): string {
  // Complexity score: higher = more error-prone
  const complexity = (qubits / 20) + (depth / 100) + (gateCount / 500)
  if (complexity >= 1.5) return "high"
  if (complexity >= 0.6) return "medium"
  return "low"
}

/**
 * Compute adaptive shots based on circuit complexity.
 * Mirrors the client-side `calculateAdaptiveShots` in runner/page.tsx
 * so SDK and UI produce identical values for the same circuit.
 */
function calculateAdaptiveShots(qubits: number, depth: number, gateCount: number): number {
  const baseShots = 512
  const qubitFactor = Math.pow(1.3, qubits - 4)
  const depthFactor = 1 + depth / 200
  const gateFactor = 1 + gateCount / 500
  const errorAccumulation = gateCount * 0.001
  const errorFactor = 1 + errorAccumulation
  const calculated = Math.round(baseShots * qubitFactor * depthFactor * gateFactor * errorFactor)
  return Math.min(10000, Math.max(100, calculated))
}
