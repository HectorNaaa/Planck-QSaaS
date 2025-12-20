import { type NextRequest, NextResponse } from "next/server"
import { CppMLEngine } from "@/lib/ml/cpp-ml-engine"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { qubits, depth, gateCount, algorithm, dataSize, dataComplexity, targetLatency, errorMitigation } = body

    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { data: userHistory } = await supabase
      .from("ml_feature_vectors")
      .select("reward_score")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10)

    const userHistoricalAccuracy =
      userHistory && userHistory.length > 0
        ? userHistory.reduce((sum, h) => sum + (h.reward_score || 0), 0) / userHistory.length / 100
        : 0.5

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
      confidence: recommendation.confidence,
      reasoning: recommendation.reasoning,
      basedOnExecutions: recommendation.basedOnExecutions,
    })
  } catch (error) {
    console.error("[v0] ML recommendation error:", error)
    return NextResponse.json({ success: false, error: "Failed to get ML recommendation" }, { status: 500 })
  }
}
