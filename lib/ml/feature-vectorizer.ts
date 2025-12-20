/**
 * ML Feature Vectorization and Normalization
 * Converts circuit and execution parameters into normalized vectors for ML
 */

export interface CircuitFeatures {
  qubits: number
  depth: number
  gateCount: number
  algorithm: string
  dataSize: number
  dataComplexity: number
  targetLatency: number | null
  errorMitigation: string
  userHistoricalAccuracy: number
}

export interface NormalizedFeatures {
  vector: number[] // 12-dimensional normalized vector
  metadata: Record<string, any>
  hash: string
}

export class FeatureVectorizer {
  // Normalization bounds (min, max) for each feature
  private static readonly BOUNDS = {
    qubits: [2, 50],
    depth: [1, 200],
    gateCount: [1, 500],
    algorithmComplexity: [1, 10], // Encoded complexity
    dataSize: [1, 1000000],
    dataComplexity: [0, 1],
    targetLatency: [10, 10000],
    errorMitigationLevel: [0, 3],
    userAccuracy: [0, 1],
    timeOfDay: [0, 24],
    dayOfWeek: [0, 7],
    circuitDensity: [0, 1], // gates / (qubits * depth)
  }

  /**
   * Normalize a value to 0-1 range using min-max normalization
   */
  private static normalize(value: number, min: number, max: number): number {
    return Math.max(0, Math.min(1, (value - min) / (max - min)))
  }

  /**
   * Encode algorithm type as complexity score
   */
  private static encodeAlgorithm(algorithm: string): number {
    const complexityMap: Record<string, number> = {
      bell: 1,
      grover: 5,
      shor: 10,
      vqe: 7,
      qaoa: 8,
      qft: 6,
      unknown: 3,
    }
    return complexityMap[algorithm.toLowerCase()] || 3
  }

  /**
   * Encode error mitigation level
   */
  private static encodeErrorMitigation(level: string): number {
    const levelMap: Record<string, number> = {
      none: 0,
      low: 1,
      medium: 2,
      high: 3,
    }
    return levelMap[level.toLowerCase()] || 0
  }

  /**
   * Calculate circuit density (gates per qubit-depth)
   */
  private static calculateDensity(qubits: number, depth: number, gateCount: number): number {
    if (qubits === 0 || depth === 0) return 0
    return Math.min(1, gateCount / (qubits * depth))
  }

  /**
   * Vectorize circuit features into normalized 12D vector
   */
  static vectorize(features: CircuitFeatures): NormalizedFeatures {
    const now = new Date()
    const timeOfDay = now.getHours() + now.getMinutes() / 60
    const dayOfWeek = now.getDay()

    const algorithmComplexity = this.encodeAlgorithm(features.algorithm)
    const errorMitigationLevel = this.encodeErrorMitigation(features.errorMitigation)
    const circuitDensity = this.calculateDensity(features.qubits, features.depth, features.gateCount)

    // Create 12-dimensional normalized vector
    const vector = [
      this.normalize(features.qubits, ...this.BOUNDS.qubits),
      this.normalize(features.depth, ...this.BOUNDS.depth),
      this.normalize(features.gateCount, ...this.BOUNDS.gateCount),
      this.normalize(algorithmComplexity, ...this.BOUNDS.algorithmComplexity),
      this.normalize(Math.log10(features.dataSize + 1), 0, 6), // Log scale for data size
      this.normalize(features.dataComplexity, ...this.BOUNDS.dataComplexity),
      this.normalize(features.targetLatency || 1000, ...this.BOUNDS.targetLatency),
      this.normalize(errorMitigationLevel, ...this.BOUNDS.errorMitigationLevel),
      this.normalize(features.userHistoricalAccuracy, ...this.BOUNDS.userAccuracy),
      this.normalize(timeOfDay, ...this.BOUNDS.timeOfDay),
      this.normalize(dayOfWeek, ...this.BOUNDS.dayOfWeek),
      this.normalize(circuitDensity, ...this.BOUNDS.circuitDensity),
    ]

    const metadata = {
      raw_features: features,
      algorithm_complexity: algorithmComplexity,
      error_mitigation_level: errorMitigationLevel,
      circuit_density: circuitDensity,
      time_of_day: timeOfDay,
      day_of_week: dayOfWeek,
    }

    // Create hash for deduplication
    const hash = this.hashVector(vector)

    return { vector, metadata, hash }
  }

  /**
   * Create a hash of the vector for deduplication
   */
  private static hashVector(vector: number[]): string {
    // Round to 2 decimals and create hash string
    const rounded = vector.map((v) => Math.round(v * 100) / 100)
    return rounded.join("-")
  }

  /**
   * Calculate reward score based on execution outcomes
   */
  static calculateReward(
    actualFidelity: number,
    actualRuntime: number,
    targetLatency: number | null,
    backend: string,
  ): number {
    // Reward components (0-1 each)
    const fidelityReward = actualFidelity / 100 // Higher fidelity is better

    // Runtime reward: 1.0 if meets target, decreases if over
    let runtimeReward = 1.0
    if (targetLatency !== null) {
      if (actualRuntime <= targetLatency) {
        runtimeReward = 1.0
      } else {
        // Penalize for exceeding target (exponential decay)
        const excess = (actualRuntime - targetLatency) / targetLatency
        runtimeReward = Math.exp(-excess)
      }
    } else {
      // Reward faster execution when no target set
      runtimeReward = Math.max(0, 1 - actualRuntime / 10000)
    }

    // Cost efficiency reward based on backend
    const costReward =
      {
        quantum_inspired_gpu: 1.0, // Cheapest
        hpc_gpu: 0.7, // Moderate cost
        quantum_qpu: 0.4, // Most expensive
      }[backend] || 0.5

    // Weighted composite score
    const reward = 0.5 * fidelityReward + 0.3 * runtimeReward + 0.2 * costReward

    return Math.max(0, Math.min(1, reward))
  }
}
