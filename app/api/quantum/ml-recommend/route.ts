import { type NextRequest, NextResponse } from "next/server"
import { CppMLEngine } from "@/lib/ml/cpp-ml-engine"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { qubits, depth, gateCount, algorithm, dataSize, dataComplexity, targetLatency, errorMitigation } = body

    const supabase = await createServerClient()
    
    // Authenticate via API key or session
    const apiKey = request.headers.get("x-api-key")
    let userId: string | null = null
    
    if (apiKey) {
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
        console.error("Error checking ML history:", tableError)
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
    console.error("ML recommendation error:", error)
    return NextResponse.json({ success: false, error: "Failed to get ML recommendation" }, { status: 500 })
  }
}
