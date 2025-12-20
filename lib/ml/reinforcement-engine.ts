/**
 * Reinforcement Learning Engine with Network Effect
 * Learns from all users' execution history to optimize shots and backend selection
 */

import { createServerClient } from "@/lib/supabase/server"
import { FeatureVectorizer, type CircuitFeatures } from "./feature-vectorizer"
import type { Backend } from "@/lib/backend-selector"

export interface MLRecommendation {
  recommendedShots: number
  recommendedBackend: Backend
  confidence: number
  basedOnExecutions: number
  reasoning: string
}

export class ReinforcementEngine {
  /**
   * Get ML-powered recommendation for shots and backend
   * Uses network effect: learns from all users' historical data
   */
  static async getRecommendation(features: CircuitFeatures): Promise<MLRecommendation> {
    const supabase = await createServerClient()

    // Vectorize features
    const normalized = FeatureVectorizer.vectorize(features)

    // Check cache first
    const cached = await this.checkCache(normalized.hash)
    if (cached) {
      console.log("[v0] Using cached ML recommendation")
      return cached
    }

    // Find similar historical executions using vector similarity
    const { data: similarExecutions, error } = await supabase.rpc("find_similar_executions", {
      query_vector: `[${normalized.vector.join(",")}]`,
      similarity_threshold: 0.75,
      limit_count: 100,
    })

    if (error) {
      console.error("[v0] Error finding similar executions:", error)
      return this.getFallbackRecommendation(features)
    }

    if (!similarExecutions || similarExecutions.length < 5) {
      console.log("[v0] Insufficient historical data, using fallback recommendation")
      return this.getFallbackRecommendation(features)
    }

    // Apply reinforcement learning: weight by reward score
    const weightedShots = this.calculateWeightedAverage(
      similarExecutions.map((e: any) => ({
        value: e.actual_shots,
        weight: e.reward_score * e.similarity,
      })),
    )

    const backendVotes = this.calculateBackendVotes(
      similarExecutions.map((e: any) => ({
        backend: e.actual_backend,
        weight: e.reward_score * e.similarity,
      })),
    )

    const recommendation: MLRecommendation = {
      recommendedShots: Math.round(weightedShots),
      recommendedBackend: backendVotes.winner as Backend,
      confidence: backendVotes.confidence,
      basedOnExecutions: similarExecutions.length,
      reasoning: this.generateReasoning(similarExecutions, backendVotes.winner, weightedShots),
    }

    // Cache recommendation
    await this.cacheRecommendation(normalized.hash, recommendation)

    console.log("[v0] ML Recommendation:", recommendation)
    return recommendation
  }

  /**
   * Record execution outcome for future learning (network effect)
   */
  static async recordExecution(
    features: CircuitFeatures,
    executionId: string,
    userId: string,
    outcomes: {
      actualShots: number
      actualBackend: Backend
      actualRuntime: number
      actualSuccessRate: number
      actualFidelity: number
      predictedShots: number
      predictedBackend: Backend
      predictedRuntime: number
      predictedFidelity: number
    },
  ): Promise<void> {
    const supabase = await createServerClient()

    // Vectorize features
    const normalized = FeatureVectorizer.vectorize(features)

    // Calculate reward score
    const reward = FeatureVectorizer.calculateReward(
      outcomes.actualFidelity,
      outcomes.actualRuntime,
      features.targetLatency,
      outcomes.actualBackend,
    )

    // Store feature vector and outcomes
    const { error } = await supabase.from("ml_feature_vectors").insert({
      execution_id: executionId,
      user_id: userId,
      features: `[${normalized.vector.join(",")}]`,
      feature_metadata: normalized.metadata,
      actual_shots: outcomes.actualShots,
      actual_backend: outcomes.actualBackend,
      actual_runtime_ms: outcomes.actualRuntime,
      actual_success_rate: outcomes.actualSuccessRate,
      actual_fidelity: outcomes.actualFidelity,
      predicted_shots: outcomes.predictedShots,
      predicted_backend: outcomes.predictedBackend,
      predicted_runtime_ms: outcomes.predictedRuntime,
      predicted_fidelity: outcomes.predictedFidelity,
      reward_score: reward,
    })

    if (error) {
      console.error("[v0] Error recording ML execution:", error)
    } else {
      console.log(`[v0] Recorded ML execution with reward: ${reward.toFixed(3)}`)
    }

    // Update model performance metrics asynchronously
    this.updateModelMetrics(outcomes).catch(console.error)
  }

  /**
   * Calculate weighted average with reward-based weighting
   */
  private static calculateWeightedAverage(data: { value: number; weight: number }[]): number {
    if (data.length === 0) return 1024 // Default shots

    const totalWeight = data.reduce((sum, d) => sum + d.weight, 0)
    if (totalWeight === 0) return data[0].value

    const weightedSum = data.reduce((sum, d) => sum + d.value * d.weight, 0)
    return weightedSum / totalWeight
  }

  /**
   * Calculate backend votes with reward-based weighting
   */
  private static calculateBackendVotes(data: { backend: string; weight: number }[]): {
    winner: string
    confidence: number
  } {
    const votes: Record<string, number> = {}

    for (const d of data) {
      votes[d.backend] = (votes[d.backend] || 0) + d.weight
    }

    const entries = Object.entries(votes).sort((a, b) => b[1] - a[1])
    if (entries.length === 0) return { winner: "quantum_inspired_gpu", confidence: 0 }

    const totalVotes = entries.reduce((sum, [, v]) => sum + v, 0)
    const topVotes = entries[0][1]

    return {
      winner: entries[0][0],
      confidence: topVotes / totalVotes,
    }
  }

  /**
   * Generate human-readable reasoning
   */
  private static generateReasoning(similarExecutions: any[], backend: string, shots: number): string {
    const avgFidelity =
      similarExecutions.reduce((sum: number, e: any) => sum + (e.actual_success_rate || 0), 0) /
      similarExecutions.length

    return `Based on ${similarExecutions.length} similar executions with ${avgFidelity.toFixed(1)}% avg fidelity. Recommended ${backend} with ${shots} shots for optimal performance.`
  }

  /**
   * Fallback recommendation when insufficient data
   */
  private static getFallbackRecommendation(features: CircuitFeatures): MLRecommendation {
    // Simple heuristic-based fallback
    let shots = 1024
    let backend: Backend = "quantum_inspired_gpu"

    if (features.qubits > 15) {
      shots = 2048
      backend = "hpc_gpu"
    }

    if (features.qubits > 20 || features.gateCount > 150) {
      shots = 4096
      backend = features.targetLatency && features.targetLatency >= 500 ? "quantum_qpu" : "hpc_gpu"
    }

    return {
      recommendedShots: shots,
      recommendedBackend: backend,
      confidence: 0.5,
      basedOnExecutions: 0,
      reasoning: "Using fallback heuristics (insufficient historical data for ML)",
    }
  }

  /**
   * Check recommendation cache
   */
  private static async checkCache(hash: string): Promise<MLRecommendation | null> {
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from("ml_recommendations")
      .select("*")
      .eq("feature_hash", hash)
      .gt("expires_at", new Date().toISOString())
      .single()

    if (error || !data) return null

    return {
      recommendedShots: data.recommended_shots,
      recommendedBackend: data.recommended_backend as Backend,
      confidence: data.confidence_score,
      basedOnExecutions: data.based_on_executions,
      reasoning: `Cached recommendation (expires in ${Math.round((new Date(data.expires_at).getTime() - Date.now()) / 60000)}min)`,
    }
  }

  /**
   * Cache recommendation for future use
   */
  private static async cacheRecommendation(hash: string, rec: MLRecommendation): Promise<void> {
    const supabase = await createServerClient()

    await supabase.from("ml_recommendations").upsert(
      {
        feature_hash: hash,
        recommended_shots: rec.recommendedShots,
        recommended_backend: rec.recommendedBackend,
        confidence_score: rec.confidence,
        based_on_executions: rec.basedOnExecutions,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
      },
      { onConflict: "feature_hash" },
    )
  }

  /**
   * Update model performance metrics
   */
  private static async updateModelMetrics(outcomes: any): Promise<void> {
    const supabase = await createServerClient()

    // Calculate accuracy metrics
    const shotsAccuracy = 1 - Math.abs(outcomes.actualShots - outcomes.predictedShots) / outcomes.actualShots
    const backendMatch = outcomes.actualBackend === outcomes.predictedBackend ? 1 : 0
    const fidelityError = Math.abs(outcomes.actualFidelity - outcomes.predictedFidelity)

    await supabase.from("ml_model_metrics").insert([
      { metric_type: "shots_accuracy", metric_value: shotsAccuracy, sample_size: 1, time_window: "1h" },
      { metric_type: "backend_accuracy", metric_value: backendMatch, sample_size: 1, time_window: "1h" },
      { metric_type: "fidelity_error", metric_value: fidelityError, sample_size: 1, time_window: "1h" },
    ])
  }
}
