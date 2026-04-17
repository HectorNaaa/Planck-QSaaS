import { type NextRequest, NextResponse } from "next/server"
import { CppMLEngine } from "@/lib/ml/cpp-ml-engine"
import { calculateFidelity } from "@/lib/backend-selector"
import { selectBackend } from "@/lib/backend-policy"
import { checkRateLimit, getRetryAfter, validatePayloadSize } from "@/lib/rate-limiter"
import { authenticateRequest } from "@/lib/api-auth"
import { Executions } from "@/lib/db/client"
import { extractQubitCount, calculateAdaptiveShots, selectAutoErrorMitigation } from "@/lib/circuit-utils"
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
    const digitalTwinId: string | null = typeof body.digitalTwinId === "string" && body.digitalTwinId.length > 0
      ? body.digitalTwinId
      : null
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

    // ── Storage cap: 50 MB per user ────────────────────────────────────────
    const STORAGE_CAP_BYTES = 50 * 1024 * 1024 // 50 MB
    try {
      const usedBytes = Executions.getStorageSizeByUserId(userId)
      if (usedBytes >= STORAGE_CAP_BYTES) {
        return NextResponse.json(
          {
            success: false,
            storage_limit_exceeded: true,
            used_mb: (usedBytes / 1_048_576).toFixed(2),
            error:
              "Execution history storage limit reached (50 MB). Please delete some execution history in QSaaS → Settings → Execution History & Storage to free space, then try again.",
          },
          { status: 429 }
        )
      }
    } catch { /* DB unavailable — non-fatal, allow the request */ }
    // session client for browser requests that already pass RLS.
    // Supabase logic removed; use internal DB logic here

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

    // Save execution to internal SQLite DB
    const circuitDataJson = JSON.stringify({
      source,
      digital_twin_id: digitalTwinId,
      results: { fidelity: actualFidelity, counts: results.counts },
    })
    const { id: executionId } = Executions.create({
      user_id: userId,
      circuit_name: circuitName || `${algorithm} Execution`,
      algorithm,
      execution_type: executionType,
      backend: effectiveBackend,
      status: "completed",
      success_rate: results.successRate,
      runtime_ms: Math.round(results.runtime),
      qubits_used: resolvedQubits,
      shots: effectiveShots,
      error_mitigation: effectiveErrorMitigation,
      backend_selected: effectiveBackend,
      backend_reason: policyResult.reason,
      backend_hint: backend === "auto" ? null : backend,
      circuit_data: circuitDataJson,
      result: JSON.stringify(results.counts),
    })

    // ML recording disabled (no Supabase). Non-critical, skip.

    return NextResponse.json({
      success: true,
      counts: results.counts,
      successRate: results.successRate,
      runtime: results.runtime,
      memory: results.memory,
      total_shots: effectiveShots,
      error_mitigation: effectiveErrorMitigation,
      error_mitigation_requested: errorMitigation,
      execution_id: executionId,
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

// extractQubitCount, calculateAdaptiveShots, selectAutoErrorMitigation
// are imported from @/lib/circuit-utils — do not redefine here.

