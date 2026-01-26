import { type NextRequest, NextResponse } from "next/server"
import { CppMLEngine } from "@/lib/ml/cpp-ml-engine"
import { createServerClient } from "@/lib/supabase/server"
import {
  validateApiKey,
  validateAlgorithm,
  validateQubits,
  validateDepth,
  validateGateCount,
  validateNumber,
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
    const qubits = validateQubits(body.qubits)
    const depth = validateDepth(body.depth)
    const gateCount = validateGateCount(body.gateCount)
    const algorithm = validateAlgorithm(body.algorithm)
    const dataSize = validateNumber(body.dataSize, 1, 100000, 100)
    const dataComplexity = validateNumber(body.dataComplexity, 0, 10, 1)
    const targetLatency = validateNumber(body.targetLatency, 0, 60000, 1000)
    const errorMitigation = body.errorMitigation || "medium"

    const supabase = await createServerClient()
    
    // Authenticate via API key or session
    const apiKey = request.headers.get("x-api-key")
    let userId: string | null = null
    
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
      userId = profile.id
    } else {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        return NextResponse.json(
          { success: false, error: "Unauthorized. Please provide an API key or authenticate." },
          { status: 401 }
        )
      }
      userId = user.id
    }

    let userHistoricalAccuracy = 0.5
    try {
      const { data: userHistory, error: historyError } = await supabase
        .from("ml_feature_vectors")
        .select("reward_score")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10)

      // If table doesn't exist (PGRST205 error), continue with default values
      if (historyError && historyError.code !== "PGRST205") {
        throw historyError
      }

      if (userHistory && userHistory.length > 0) {
        userHistoricalAccuracy =
          userHistory.reduce((sum, h) => sum + (h.reward_score || 0), 0) / userHistory.length / 100
      }
    } catch (tableError: any) {
      // ML tables not yet created, use default heuristics
      if (tableError.code !== "PGRST205") {
        console.error("[API] Error checking ML history:", tableError)
      }
    }

    const recommendation = await CppMLEngine.getRecommendation({
      qubits,
      depth,
      gateCount,
      algorithm,
      dataSize,
      dataComplexity,
      targetLatency,
      errorMitigation,
      userHistoricalAccuracy,
    })

    return NextResponse.json({
      success: true,
      recommendedShots: recommendation.recommendedShots,
      recommendedBackend: recommendation.recommendedBackend,
      recommendedErrorMitigation: recommendation.recommendedErrorMitigation,
      confidence: recommendation.confidence,
      reasoning: recommendation.reasoning,
      basedOnExecutions: recommendation.basedOnExecutions,
    })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, "Failed to get ML recommendation")
    console.error("[API] ML recommendation error:", error)
    return NextResponse.json(
      { success: false, error: safeError },
      { status: 500 }
    )
  }
}
