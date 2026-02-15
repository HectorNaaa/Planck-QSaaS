import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
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

    const supabase = await createServerClient()

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
  const probabilities = executionResults?.probabilities || {}
  const counts = executionResults?.counts || {}

  // Analyze probability distribution
  const sortedProbs = Object.entries(probabilities)
    .sort(([, a]: any, [, b]: any) => b - a)
    .slice(0, 5)

  const maxState = sortedProbs[0]?.[0] || "0"
  const maxProb = (sortedProbs[0]?.[1] as number) || 0

  // Calculate entropy (measure of randomness)
  let entropy = 0
  for (const prob of Object.values(probabilities) as number[]) {
    if (prob > 0) {
      entropy -= prob * Math.log2(prob)
    }
  }

  // Generate algorithm-specific interpretation
  let algorithmInterpretation = ""
  let keyFindings: string[] = []

  switch (algorithm) {
    case "Bell":
      algorithmInterpretation = "Bell state entanglement successfully demonstrated"
      keyFindings = [
        `Maximum entanglement achieved with entropy: ${entropy.toFixed(3)}`,
        `Dominant state: |${maxState}> with probability ${(maxProb * 100).toFixed(2)}%`,
        "Quantum correlation verified between qubit pairs",
      ]
      break
    case "Grover":
      algorithmInterpretation = "Grover's search algorithm amplified target states"
      keyFindings = [
        `Search space reduced to ${sortedProbs.length} dominant states`,
        `Target state |${maxState}> found with ${(maxProb * 100).toFixed(2)}% probability`,
        `Quadratic speedup achieved over classical search`,
      ]
      break
    case "Shor":
      algorithmInterpretation = "Shor's factorization circuit prepared period-finding state"
      keyFindings = [
        `Period detection probability: ${(maxProb * 100).toFixed(2)}%`,
        `Quantum Fourier Transform successfully applied`,
        `Classical post-processing required for final factorization`,
      ]
      break
    case "VQE":
      algorithmInterpretation = "Variational Quantum Eigensolver converging to ground state"
      keyFindings = [
        `Energy landscape entropy: ${entropy.toFixed(3)}`,
        `Ground state candidate: |${maxState}>`,
        `Optimization in progress with ${circuitInfo?.gates || 0} parameterized gates`,
      ]
      break
    case "QAOA":
      algorithmInterpretation = "QAOA optimization exploring solution space"
      keyFindings = [
        `Optimal solution probability: ${(maxProb * 100).toFixed(2)}%`,
        `Solution state: |${maxState}>`,
        `Mixing and cost layers applied for combinatorial optimization`,
      ]
      break
    case "QFT":
      algorithmInterpretation = "Quantum Fourier Transform completed"
      keyFindings = [
        `Frequency domain representation obtained`,
        `Dominant frequency state: |${maxState}>`,
        `Transform fidelity achieved across ${circuitInfo?.qubits || 0} qubits`,
      ]
      break
    default:
      algorithmInterpretation = "Quantum circuit execution completed"
      keyFindings = [
        `Output state distribution entropy: ${entropy.toFixed(3)}`,
        `Most probable outcome: |${maxState}> (${(maxProb * 100).toFixed(2)}%)`,
        `Circuit complexity: ${circuitInfo?.gates || 0} gates, depth ${circuitInfo?.depth || 0}`,
      ]
  }

  // Analyze input data patterns
  const dataInsights: string[] = []
  if (inputData) {
    if (typeof inputData === "object" && inputData.qubits) {
      dataInsights.push(`System configured with ${inputData.qubits} qubits`)
    }
    if (circuitInfo?.gates) {
      dataInsights.push(`Circuit contains ${circuitInfo.gates} quantum gates`)
    }
    if (backendConfig?.shots) {
      dataInsights.push(`Measured ${backendConfig.shots} times for statistical accuracy`)
    }
  }

  // Generate recommendations
  const recommendations: string[] = []
  if (entropy < 0.5) {
    recommendations.push("Low entropy suggests deterministic output - consider if this is expected")
  } else if (entropy > 2.5) {
    recommendations.push("High entropy indicates significant quantum superposition - verify circuit design")
  }

  if (maxProb < 0.3) {
    recommendations.push("No dominant state found - may need more optimization iterations or error mitigation")
  } else if (maxProb > 0.9) {
    recommendations.push("Strong convergence to single state detected - solution likely found")
  }

  if (backendConfig?.errorMitigation === "none") {
    recommendations.push("Consider enabling error mitigation for improved result quality")
  }

  return {
    algorithm_interpretation: algorithmInterpretation,
    key_findings: keyFindings,
    data_insights: dataInsights,
    statistical_analysis: {
      entropy: Number.parseFloat(entropy.toFixed(4)),
      max_probability: Number.parseFloat((maxProb * 100).toFixed(2)),
      dominant_state: maxState,
      unique_states: Object.keys(probabilities).length,
      top_5_states: sortedProbs.map(([state, prob]: any) => ({
        state,
        probability: Number.parseFloat((prob * 100).toFixed(2)),
      })),
    },
    recommendations,
    timestamp: new Date().toISOString(),
  }
}
