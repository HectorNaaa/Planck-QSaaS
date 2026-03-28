import { type NextRequest, NextResponse } from "next/server"
import { CppMLEngine } from "@/lib/ml/cpp-ml-engine"
import { createServerClient } from "@/lib/supabase/server"
import { getAdminClient } from "@/lib/supabase/admin"
import { authenticateRequest } from "@/lib/api-auth"
import {
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

    let userHistoricalAccuracy = 0.5
    try {
      // Try mega-table first, fall back to legacy
      const { data: userHistory, error: historyError } = await supabase
        .from("ml_execution_features")
        .select("reward_score")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20)

      if (historyError && historyError.code !== "PGRST205" && historyError.code !== "42P01") {
        // Try legacy table
        const { data: legacyHistory } = await supabase
          .from("ml_feature_vectors")
          .select("reward_score")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(10)

        if (legacyHistory && legacyHistory.length > 0) {
          userHistoricalAccuracy =
            legacyHistory.reduce((sum, h) => sum + (h.reward_score || 0), 0) / legacyHistory.length / 100
        }
      } else if (userHistory && userHistory.length > 0) {
        userHistoricalAccuracy =
          userHistory.reduce((sum, h) => sum + (h.reward_score || 0), 0) / userHistory.length / 100
      }
    } catch (tableError: any) {
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
