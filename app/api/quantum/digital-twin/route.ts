import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { getAdminClient } from "@/lib/supabase/admin"
import { authenticateRequest } from "@/lib/api-auth"
import {
  validateAlgorithm,
  validateInputData,
  validateUUID,
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
    
    // Validate and sanitize inputs
    const algorithm = validateAlgorithm(body.algorithm)
    
    // Validate input data
    const inputDataValidation = validateInputData(body.inputData)
    const inputData = inputDataValidation.valid ? inputDataValidation.data : null
    
    const circuitInfo = body.circuitInfo || {}
    const executionResults = body.executionResults || {}
    const backendConfig = body.backendConfig || {}

    // Authenticate (API-key via service-role or session cookie)
    const auth = await authenticateRequest(request)
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }
    const userId = auth.userId!

    // Use admin client for SDK requests to bypass RLS
    const supabase = auth.method === "api_key"
      ? getAdminClient()
      : await createServerClient()

    // Generate digital twin insights
    const digitalTwin = generateDigitalTwinInsights(algorithm, inputData, circuitInfo, executionResults, backendConfig)

    // Save to Supabase if execution_id is provided and valid
    if (executionResults?.execution_id && validateUUID(executionResults.execution_id)) {
      try {
        const { error: updateError } = await supabase
          .from("execution_logs")
          .update({
            digital_twin: digitalTwin,
          })
          .eq("user_id", userId)
          .eq("id", executionResults.execution_id)

        if (updateError) {
          console.error("[API] Failed to save Digital Twin to Supabase:", updateError.message)
        }
      } catch (saveError) {
        console.error("[API] Error saving digital twin:", saveError)
      }
    }

    return NextResponse.json({
      success: true,
      digital_twin: digitalTwin,
    })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, "Failed to generate Digital Twin")
    console.error("[API] Digital Twin generation error:", error)
    return NextResponse.json(
      { success: false, error: safeError },
      { status: 500 }
    )
  }
}

function generateDigitalTwinInsights(
  algorithm: string,
  inputData: any,
  circuitInfo: any,
  executionResults: any,
  backendConfig: any,
) {
  const counts: Record<string, number> = executionResults?.counts || {}
  const totalShots = Object.values(counts).reduce((a: number, b: number) => a + b, 0) || 1
  const qubitsUsed = circuitInfo?.qubits || 4
  const circuitDepth = circuitInfo?.depth || 1
  const gateCount = Array.isArray(circuitInfo?.gates) ? circuitInfo.gates.length : (circuitInfo?.gates || 0)
  const successRate = executionResults?.success_rate || 0
  const runtimeMs = executionResults?.runtime_ms || 0
  const errorMitigation = backendConfig?.error_mitigation || backendConfig?.errorMitigation || "none"

  // ── Probabilities & entropy ─────────────────────────────────
  const probabilities = Object.entries(counts).map(([state, count]) => ({
    state,
    probability: (count as number) / totalShots,
  }))
  probabilities.sort((a, b) => b.probability - a.probability)

  const entropy = -probabilities.reduce((sum, { probability: p }) => {
    return sum + (p > 0 ? p * Math.log2(p) : 0)
  }, 0)

  const topStates = probabilities.slice(0, 5)
  const dominantState = topStates[0] || { state: "0", probability: 0 }
  const uniformity = qubitsUsed > 0 ? entropy / qubitsUsed : 0

  // ── Performance metrics (dynamic, based on actual results) ──
  const performanceMetrics = {
    executionSpeed: runtimeMs < 100 ? "excellent" : runtimeMs < 500 ? "good" : "acceptable",
    convergence: successRate > 90 ? "strong" : successRate > 70 ? "moderate" : "weak",
    reliability: uniformity < 0.5 ? "high" : uniformity < 0.8 ? "medium" : "low",
  }

  // ── Algorithm-specific interpretation ───────────────────────
  let interpretation = ""
  let behaviorInsights: string[] = []
  let systemRecommendations: string[] = []

  switch (algorithm) {
    case "Bell":
      interpretation = "Bell state circuit demonstrates quantum entanglement between qubits. The system creates maximally entangled pairs showing perfect correlation."
      behaviorInsights = [
        `Entanglement fidelity: ${(dominantState.probability * 100).toFixed(2)}%`,
        `Detected ${topStates.length} primary quantum states with ${uniformity.toFixed(2)} distribution uniformity`,
        `Circuit depth of ${circuitDepth} gates maintains coherence across ${qubitsUsed} qubits`,
      ]
      systemRecommendations = [
        uniformity < 0.5
          ? "Low entropy suggests strong entanglement - consider adding more qubits for complex correlations"
          : "High entropy indicates decoherence - reduce circuit depth or increase error mitigation",
        errorMitigation === "none"
          ? "Enable error mitigation to improve Bell state fidelity"
          : "Current error mitigation preserves quantum correlations effectively",
      ]
      break

    case "Grover":
      interpretation = "Grover's algorithm performs quantum search with quadratic speedup. The Digital Twin models the amplitude amplification process and convergence to target states."
      behaviorInsights = [
        `Search success rate: ${successRate.toFixed(2)}% - ${dominantState.state} is the marked state`,
        `Optimal iterations achieved with ${circuitDepth} oracle calls for ${qubitsUsed} qubits`,
        `Amplitude amplification factor: ${(dominantState.probability / (1 / Math.pow(2, qubitsUsed))).toFixed(2)}x`,
      ]
      systemRecommendations = [
        successRate > 90
          ? "Excellent convergence - the oracle and diffusion operators are well-calibrated"
          : "Consider adjusting iteration count: optimal is ~pi/4 * sqrt(2^n) for n qubits",
        inputData
          ? `Input data size suggests ${Math.ceil(Math.log2((Array.isArray(inputData) ? inputData.length : 1) || 1))} qubits minimum`
          : "Provide structured input data for more accurate search target identification",
      ]
      break

    case "Shor":
      interpretation = "Shor's algorithm demonstrates quantum factorization using period finding. The Digital Twin tracks quantum Fourier transform behavior and phase estimation accuracy."
      behaviorInsights = [
        `Period detection probability: ${(dominantState.probability * 100).toFixed(2)}%`,
        `QFT precision with ${qubitsUsed} qubits enables factorization of ${Math.pow(2, Math.floor(qubitsUsed / 2))}-bit numbers`,
        `Phase estimation converged after ${runtimeMs.toFixed(3)}ms with ${totalShots} measurements`,
      ]
      systemRecommendations = [
        qubitsUsed < 8
          ? "Increase qubit count to 8+ for practical factorization demonstrations"
          : "Qubit count is sufficient for demonstrating period-finding on larger composite numbers",
        "Consider implementing modular exponentiation optimization for faster execution",
      ]
      break

    case "VQE":
      interpretation = "Variational Quantum Eigensolver optimizes quantum states to find ground state energies. The Digital Twin monitors convergence patterns and energy landscape exploration."
      behaviorInsights = [
        `Energy convergence rate: ${(successRate / 100).toFixed(4)} per iteration`,
        `Ansatz depth of ${circuitDepth} provides ${Math.pow(2, qubitsUsed)} parameter dimensions`,
        `State preparation entropy: ${entropy.toFixed(3)} bits indicates ${uniformity > 0.7 ? "broad" : "focused"} energy landscape sampling`,
      ]
      systemRecommendations = [
        entropy > 2
          ? "High entropy suggests the optimizer is exploring - increase iterations or adjust learning rate"
          : "Low entropy indicates convergence - consider different initial parameters to avoid local minima",
        errorMitigation !== "none"
          ? "Error mitigation active - critical for accurate energy estimation"
          : "Enable error mitigation to reduce measurement noise in energy calculations",
      ]
      break

    case "QAOA":
      interpretation = "Quantum Approximate Optimization Algorithm solves combinatorial problems using alternating problem and mixer Hamiltonians. The Digital Twin analyzes optimization trajectory and solution quality."
      behaviorInsights = [
        `Solution approximation ratio: ${(successRate / 100).toFixed(3)}`,
        `Circuit layers (p=${Math.floor(circuitDepth / 2)}): ${circuitDepth / 2 > 5 ? "deep exploration" : "shallow approximation"}`,
        `State distribution shows ${topStates.length} competitive candidate solutions`,
      ]
      systemRecommendations = [
        dominantState.probability < 0.3
          ? "Increase QAOA layers (p value) for better solution quality"
          : "Current layer depth achieves good solution concentration",
        inputData
          ? "Graph structure detected - ensure problem encoding matches connectivity constraints"
          : "Provide problem graph for optimized mixer Hamiltonian design",
      ]
      break

    case "QFT":
      interpretation = "Quantum Fourier Transform completed. The Digital Twin analyzes frequency domain representation and phase accuracy."
      behaviorInsights = [
        `Frequency domain representation obtained with ${qubitsUsed} qubits`,
        `Dominant frequency state: |${dominantState.state}> at ${(dominantState.probability * 100).toFixed(2)}%`,
        `Transform fidelity achieved across ${qubitsUsed} qubits with entropy ${entropy.toFixed(3)}`,
      ]
      systemRecommendations = [
        entropy < 1 ? "Low entropy indicates clean frequency signal" : "Higher entropy suggests spectral noise - increase shots",
        `Runtime ${runtimeMs.toFixed(1)}ms ${runtimeMs < 200 ? "is efficient for this circuit size" : "could be improved by reducing depth"}`,
      ]
      break

    default:
      interpretation = `Custom quantum algorithm with ${qubitsUsed} qubits and ${circuitDepth} gate depth. The Digital Twin provides general quantum behavior analysis.`
      behaviorInsights = [
        `Measurement entropy: ${entropy.toFixed(3)} bits`,
        `Top measurement outcome: ${dominantState.state} (${(dominantState.probability * 100).toFixed(2)}%)`,
        `State space exploration: ${probabilities.length} unique outcomes from ${totalShots} shots`,
      ]
      systemRecommendations = [
        "Analyze gate composition to understand quantum state evolution",
        uniformity > 0.8 ? "High uniformity - circuit may need more structure" : "Good state concentration observed",
      ]
  }

  // ── Data patterns ───────────────────────────────────────────
  const dataPatterns: string[] = []
  if (inputData) {
    if (Array.isArray(inputData)) {
      dataPatterns.push(`Input dataset contains ${inputData.length} data points`)
      if (inputData.length > 0 && typeof inputData[0] === "number") {
        const avg = inputData.reduce((a: number, b: number) => a + b, 0) / inputData.length
        dataPatterns.push(`Average input value: ${avg.toFixed(2)}`)
      }
    } else if (typeof inputData === "object") {
      const keys = Object.keys(inputData)
      dataPatterns.push(
        `Input contains ${keys.length} features: ${keys.slice(0, 3).join(", ")}${keys.length > 3 ? "..." : ""}`,
      )
    }
  }

  // ── Topology insights ───────────────────────────────────────
  const backendLabel = (backendConfig?.backend || "unknown").replace(/_/g, " ")
  const topologyInsights = [
    `Circuit compiled for ${backendLabel} backend`,
    backendConfig?.transpiled
      ? "Transpilation optimized gate sequence for hardware topology"
      : "Direct compilation without transpilation",
    `Gate count: ${gateCount} | Qubit utilization: ${((qubitsUsed / 16) * 100).toFixed(1)}% of typical QPU`,
  ]

  // ── Additional dynamic recommendations ──────────────────────
  if (entropy < 0.5) {
    systemRecommendations.push("Low entropy suggests deterministic output - consider if this is expected")
  } else if (entropy > 2.5) {
    systemRecommendations.push("High entropy indicates significant quantum superposition - verify circuit design")
  }
  if (errorMitigation === "none") {
    systemRecommendations.push("Consider enabling error mitigation for improved result quality")
  }

  // ── Standard deviation of probabilities ─────────────────────
  const meanProb = probabilities.length > 0 ? probabilities.reduce((s, p) => s + p.probability, 0) / probabilities.length : 0
  const variance = probabilities.length > 0 ? probabilities.reduce((s, p) => s + Math.pow(p.probability - meanProb, 2), 0) / probabilities.length : 0
  const stdDev = Math.sqrt(variance)

  return {
    // Overview tab data
    interpretation,
    performance_metrics: performanceMetrics,
    quantum_metrics: {
      entropy: Number.parseFloat(entropy.toFixed(4)),
      uniformity: Number.parseFloat(uniformity.toFixed(4)),
      state_space: probabilities.length,
      top_states: topStates.map((s) => ({
        state: s.state,
        probability: Number.parseFloat((s.probability * 100).toFixed(2)),
      })),
    },
    // Analysis tab data
    behavior_insights: behaviorInsights,
    data_patterns: dataPatterns,
    topology_insights: topologyInsights,
    // Recommendations tab data
    system_recommendations: systemRecommendations,
    // Statistical analysis
    statistical_analysis: {
      entropy: Number.parseFloat(entropy.toFixed(4)),
      max_probability: Number.parseFloat((dominantState.probability * 100).toFixed(2)),
      dominant_state: dominantState.state,
      unique_outcomes: probabilities.length,
      std_probability: Number.parseFloat(stdDev.toFixed(6)),
      convergence: performanceMetrics.convergence,
      top_5_states: topStates.map((s) => ({
        state: s.state,
        probability: Number.parseFloat((s.probability * 100).toFixed(2)),
      })),
    },
    timestamp: new Date().toISOString(),
  }
}
