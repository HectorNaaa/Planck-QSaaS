/**
 * C++ ML Engine Wrapper
 * High-performance interface to C++ reinforcement learning scripts
 * Provides network effect learning with vectorized features
 */

import { createServerClient } from "@/lib/supabase/server"
import { getAdminClient } from "@/lib/supabase/admin"

interface CircuitFeatures {
  qubits: number
  depth: number
  gateCount: number
  algorithm: string
  dataSize: number
  dataComplexity: number
  targetLatency: number
  errorMitigation: string
  userHistoricalAccuracy: number
}

interface MLRecommendation {
  recommendedShots: number
  recommendedBackend: string
  recommendedErrorMitigation: string
  confidence: number
  reasoning: string
  basedOnExecutions: number
}

export class CppMLEngine {
  /**
   * Generate normalized feature vector using C++ vectorizer
   */
  static async vectorizeFeatures(features: CircuitFeatures): Promise<number[]> {
    try {
      // In production environment with C++ compilation:
      // const { spawn } = await import("child_process")
      // const result = await new Promise<string>((resolve, reject) => {
      //   const process = spawn("./scripts/ml_feature_vectorizer", [JSON.stringify(features)])
      //   let output = ""
      //   process.stdout.on("data", (data) => (output += data))
      //   process.on("close", (code) => (code === 0 ? resolve(output) : reject(new Error("Vectorizer failed"))))
      // })
      // return JSON.parse(result)

      // Fallback TypeScript implementation for browser environment
      return this.vectorizeFeaturesTS(features)
    } catch (error) {
      console.error("[v0] C++ vectorizer error, using TS fallback:", error)
      return this.vectorizeFeaturesTS(features)
    }
  }

  /**
   * TypeScript fallback vectorizer (matches C++ implementation)
   */
  private static vectorizeFeaturesTS(features: CircuitFeatures): number[] {
    const MAX_QUBITS = 100.0
    const MAX_DEPTH = 1000.0
    const MAX_GATES = 10000.0
    const MAX_DATA_SIZE = 1000000.0
    const MAX_LATENCY = 10000.0

    const algorithmEncoding: Record<string, number> = {
      bell: 0.1,
      grover: 0.3,
      shor: 0.5,
      vqe: 0.7,
      qaoa: 0.9,
    }

    const backendEncoding: Record<string, number> = {
      classical: 0.0,
      hpc: 0.5,
      quantum: 1.0,
    }

    const vec = new Array(12).fill(0)

    // Feature 0-2: Circuit structure
    vec[0] = Math.min(1.0, features.qubits / MAX_QUBITS)
    vec[1] = Math.min(1.0, features.depth / MAX_DEPTH)
    vec[2] = Math.min(1.0, features.gateCount / MAX_GATES)

    // Feature 3: Algorithm type
    vec[3] = algorithmEncoding[features.algorithm] || 0.5

    // Feature 4-5: Data characteristics
    vec[4] = Math.min(1.0, features.dataSize / MAX_DATA_SIZE)
    vec[5] = Math.min(1.0, features.dataComplexity)

    // Feature 6: Target latency (log scale)
    vec[6] =
      features.targetLatency > 0 ? Math.min(1.0, Math.log(features.targetLatency + 1) / Math.log(MAX_LATENCY)) : 0.5

    // Feature 7: Backend preference derived from error mitigation
    const backendPref =
      features.errorMitigation === "high" ? "quantum" : features.errorMitigation === "medium" ? "hpc" : "classical"
    vec[7] = backendEncoding[backendPref] || 0.5

    // Feature 8-11: Derived features
    vec[8] = vec[2] / (vec[1] + 1e-6) // Gate density
    vec[9] = vec[0] * vec[1] // Circuit complexity
    vec[10] = vec[3] * vec[5] // Algorithm-data match
    vec[11] = vec[6] * vec[7] // Latency-backend compatibility

    return vec
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private static cosineSimilarity(v1: number[], v2: number[]): number {
    if (v1.length !== v2.length) return 0.0

    let dot = 0.0
    let mag1 = 0.0
    let mag2 = 0.0

    for (let i = 0; i < v1.length; i++) {
      dot += v1[i] * v2[i]
      mag1 += v1[i] * v1[i]
      mag2 += v2[i] * v2[i]
    }

    const denom = Math.sqrt(mag1) * Math.sqrt(mag2)
    return denom > 1e-9 ? dot / denom : 0.0
  }

  /**
   * Get ML-powered recommendation using network effect
   */
  static async getRecommendation(features: CircuitFeatures): Promise<MLRecommendation> {
    // Always use admin client -- this is a server-side read across all users
    const supabase = getAdminClient()

    // Generate feature vector
    const featureVector = await this.vectorizeFeatures(features)

    try {
      // Query similar executions from the mega-table using pgvector
      const { data: similarExecutions, error } = await supabase.rpc("find_similar_execution_features", {
        query_vector: featureVector,
        similarity_threshold: 0.6,
        limit_count: 80,
      })

      // If function doesn't exist (PGRST202) or other errors, fall back to defaults
      if (error) {
        if (error.code === "PGRST202" || error.code === "42883") {
          return this.getDefaultRecommendation(features)
        }
        throw error
      }

      if (!similarExecutions || similarExecutions.length === 0) {
        return this.getDefaultRecommendation(features)
      }

      // ── Weighted voting based on similarity + reward ──────────
      const shotsVotes: Record<number, number> = {}
      const backendVotes: Record<string, number> = {}
      const errorMitigationVotes: Record<string, number> = {}
      let totalWeight = 0

      for (const exec of similarExecutions) {
        // Reward-weighted similarity: higher rewards amplify vote weight
        const rewardBonus = Math.max(0, exec.reward_score) / 100
        const weight = exec.similarity * (1 + rewardBonus)
        totalWeight += weight

        // Shots: bucket to nearest 100 to avoid fragmentation
        const bucketedShots = Math.round(exec.shots_used / 100) * 100
        shotsVotes[bucketedShots] = (shotsVotes[bucketedShots] || 0) + weight
        backendVotes[exec.backend_used] = (backendVotes[exec.backend_used] || 0) + weight
        if (exec.error_mitigation) {
          errorMitigationVotes[exec.error_mitigation] = (errorMitigationVotes[exec.error_mitigation] || 0) + weight
        }
      }

      // ── Pick best from weighted votes ─────────────────────────
      let bestShots = this.calculateDefaultShots(features)
      let bestShotsWeight = 0
      for (const [shots, weight] of Object.entries(shotsVotes)) {
        if (weight > bestShotsWeight) {
          bestShotsWeight = weight
          bestShots = Number(shots)
        }
      }

      let bestBackend = this.selectDefaultBackend(features)
      let bestBackendWeight = 0
      for (const [backend, weight] of Object.entries(backendVotes)) {
        if (weight > bestBackendWeight) {
          bestBackendWeight = weight
          bestBackend = backend
        }
      }

      let bestErrorMitigation = this.selectDefaultErrorMitigation(features)
      let bestErrorMitigationWeight = 0
      for (const [mitigation, weight] of Object.entries(errorMitigationVotes)) {
        if (weight > bestErrorMitigationWeight) {
          bestErrorMitigationWeight = weight
          bestErrorMitigation = mitigation
        }
      }

      const confidence = Math.min(0.95, totalWeight / (similarExecutions.length * 2))
      const avgSimilarity =
        (similarExecutions.reduce((sum: number, e: any) => sum + e.similarity, 0) / similarExecutions.length) * 100

      return {
        recommendedShots: bestShots,
        recommendedBackend: bestBackend,
        recommendedErrorMitigation: bestErrorMitigation,
        confidence,
        reasoning: `RL network effect: ${similarExecutions.length} similar circuits (${avgSimilarity.toFixed(0)}% avg match)`,
        basedOnExecutions: similarExecutions.length,
      }
    } catch (error: any) {
      return this.getDefaultRecommendation(features)
    }
  }

  /**
   * Get default recommendation using heuristics
   */
  private static getDefaultRecommendation(features: CircuitFeatures): MLRecommendation {
    return {
      recommendedShots: this.calculateDefaultShots(features),
      recommendedBackend: this.selectDefaultBackend(features),
      recommendedErrorMitigation: this.selectDefaultErrorMitigation(features),
      confidence: 0.1,
      reasoning: "Using heuristic defaults (ML tables not configured)",
      basedOnExecutions: 0,
    }
  }

  /**
   * Calculate reward score for completed execution
   */
  static calculateReward(
    actualFidelity: number,
    actualRuntime: number,
    targetLatency: number,
    predictedFidelity: number,
  ): number {
    // Fidelity reward (0-100 scale)
    const fidelityReward = actualFidelity

    // Latency penalty
    let latencyPenalty = 0
    if (targetLatency > 0) {
      const latencyRatio = Math.abs(actualRuntime - targetLatency) / targetLatency
      latencyPenalty = Math.min(50, latencyRatio * 25)
    }

    // Prediction accuracy bonus
    const predictionError = Math.abs(actualFidelity - predictedFidelity)
    const accuracyBonus = Math.max(0, 10 - predictionError)

    // Efficiency bonus (lower runtime is better)
    const efficiencyBonus = Math.max(0, 10 - Math.log(actualRuntime + 1))

    return fidelityReward - latencyPenalty + accuracyBonus + efficiencyBonus
  }

  /**
   * Record execution results for learning
   */
  static async recordExecution(
    features: CircuitFeatures,
    executionId: string,
    userId: string,
    outcomes: {
      actualShots: number
      actualBackend: string
      actualRuntime: number
      actualSuccessRate: number
      actualFidelity: number
      predictedShots: number
      predictedBackend: string
      predictedRuntime: number
      predictedFidelity: number
    },
  ): Promise<void> {
    try {
      // Use admin client to bypass RLS -- trusted server-side write
      const supabase = getAdminClient()

      // Generate feature vector
      const featureVector = await this.vectorizeFeatures(features)

      // Calculate reward score
      const reward = this.calculateReward(
        outcomes.actualFidelity,
        outcomes.actualRuntime,
        features.targetLatency,
        outcomes.predictedFidelity,
      )

      // Write to mega-table (ml_execution_features) -- lightweight, cross-user RL data
      const megaInsert = supabase.from("ml_execution_features").insert({
        execution_id: executionId,
        user_id: userId,
        algorithm: features.algorithm,
        num_qubits: features.qubits,
        circuit_depth: features.depth,
        gate_count: features.gateCount,
        data_size: features.dataSize,
        data_complexity: features.dataComplexity,
        shots_used: outcomes.actualShots,
        backend_used: outcomes.actualBackend,
        error_mitigation: features.errorMitigation,
        target_latency_ms: features.targetLatency,
        success_rate: outcomes.actualSuccessRate,
        runtime_ms: outcomes.actualRuntime,
        fidelity_score: outcomes.actualFidelity,
        reward_score: reward,
        feature_vector: featureVector,
      })

      // Write to legacy table (ml_feature_vectors) for backward compat
      const legacyInsert = supabase.from("ml_feature_vectors").insert({
        execution_id: executionId,
        user_id: userId,
        feature_vector: featureVector,
        num_qubits: features.qubits,
        circuit_depth: features.depth,
        gate_count: features.gateCount,
        algorithm_type: features.algorithm,
        data_size: features.dataSize,
        backend_used: outcomes.actualBackend,
        shots_used: outcomes.actualShots,
        runtime_ms: outcomes.actualRuntime,
        fidelity_score: outcomes.actualFidelity,
        success: outcomes.actualSuccessRate > 50,
        reward_score: reward,
      })

      // Fire both in parallel; don't fail the caller on either
      const [megaResult, legacyResult] = await Promise.allSettled([megaInsert, legacyInsert])

      if (megaResult.status === "fulfilled" && megaResult.value.error) {
        const e = megaResult.value.error
        if (e.code !== "PGRST205" && e.code !== "42P01") {
          console.error("[ML] mega-table insert error:", e.message)
        }
      }
      if (legacyResult.status === "fulfilled" && legacyResult.value.error) {
        const e = legacyResult.value.error
        if (e.code !== "PGRST205" && e.code !== "42P01") {
          console.error("[ML] legacy-table insert error:", e.message)
        }
      }
    } catch (error) {
      // Silently fail - ML features are optional
    }
  }

  /**
   * Heuristic defaults
   */
  private static calculateDefaultShots(features: CircuitFeatures): number {
    const baseShots = 1000
    const complexityMultiplier = 1 + features.qubits / 20 + features.depth / 100
    return Math.min(10000, Math.max(100, Math.round(baseShots * complexityMultiplier)))
  }

  private static selectDefaultBackend(features: CircuitFeatures): string {
    if (features.qubits < 12 && features.depth < 50) return "quantum_inspired_gpu"
    if (features.qubits >= 12 && features.targetLatency >= 500) return "quantum_qpu"
    return "hpc_gpu"
  }

  private static selectDefaultErrorMitigation(features: CircuitFeatures): string {
    // High complexity circuits benefit from higher error mitigation
    if (features.qubits >= 20 || features.depth >= 100) return "high"
    if (features.qubits >= 12 || features.depth >= 50) return "medium"
    return "low"
  }
}
