import { selectOptimalBackend, type Backend, type CircuitMetrics } from "./backend-selector"

export type ExecutionMode = "automatic" | "manual"

export interface CircuitConfiguration {
  qubits: number
  depth: number
  gateCount: number
  shots: number
  errorMitigation: string
}

export interface ExecutionRequest {
  mode: ExecutionMode
  manualBackend?: Backend
  circuitConfig: CircuitConfiguration
  circuitName: string
  userId: string
}

export interface ExecutionResult {
  backend: Backend
  recommendation?: string
  estimatedCost?: number
  estimatedRuntime: number
  queuePosition?: number
}

/**
 * Orchestrates quantum circuit execution by selecting the optimal backend
 * based on circuit characteristics and execution mode (manual or automatic)
 */
export class ExecutionOrchestrator {
  /**
   * Determines the appropriate backend for circuit execution
   */
  static async selectBackend(request: ExecutionRequest): Promise<ExecutionResult> {
    const { mode, manualBackend, circuitConfig } = request
    const { qubits, depth, gateCount } = circuitConfig

    const metrics: CircuitMetrics = { qubits, depth, gateCount }

    let selectedBackend: Backend
    let recommendation: string | undefined

    // Manual mode: use user-specified backend
    if (mode === "manual" && manualBackend) {
      selectedBackend = manualBackend
      const optimalBackend = selectOptimalBackend(metrics)

      // Provide recommendation if manual selection differs from optimal
      if (selectedBackend !== optimalBackend) {
        recommendation = `For optimal performance, consider using ${this.getBackendName(optimalBackend)} based on your circuit's ${qubits} qubits and depth of ${depth}.`
      }
    } else {
      // Automatic mode: select optimal backend based on circuit metrics
      selectedBackend = selectOptimalBackend(metrics)
      recommendation = this.getBackendRecommendation(selectedBackend, metrics)
    }

    // Calculate estimated runtime based on circuit complexity
    const estimatedRuntime = this.calculateEstimatedRuntime(selectedBackend, metrics)

    return {
      backend: selectedBackend,
      recommendation,
      estimatedRuntime,
    }
  }

  /**
   * Executes the circuit on the selected backend and logs to Supabase
   */
  static async execute(request: ExecutionRequest): Promise<void> {
    const result = await this.selectBackend(request)

    console.log("[v0] Execution orchestrator selected backend:", result.backend)
    console.log("[v0] Circuit config:", request.circuitConfig)
    console.log("[v0] Estimated runtime:", result.estimatedRuntime, "ms")

    // In production, this would trigger actual quantum execution
    // For now, we simulate and log to Supabase via the runner component
  }

  /**
   * Gets human-readable backend name
   */
  private static getBackendName(backend: Backend): string {
    const names = {
      quantum_inspired_gpu: "Quantum-Inspired GPU",
      hpc_gpu: "HPC GPU",
      quantum_qpu: "Quantum QPU",
    }
    return names[backend]
  }

  /**
   * Generates backend recommendation explanation
   */
  private static getBackendRecommendation(backend: Backend, metrics: CircuitMetrics): string {
    const { qubits, depth, gateCount } = metrics

    switch (backend) {
      case "quantum_inspired_gpu":
        return `Selected Quantum-Inspired GPU for efficient simulation of ${qubits} qubits with moderate depth (${depth}). Optimal for small to medium circuits.`
      case "quantum_qpu":
        return `Selected Quantum QPU for ${qubits}-qubit circuit. Real quantum hardware provides best results for this complexity level with ${gateCount} gates.`
      case "hpc_gpu":
        return `Selected HPC GPU for high-complexity circuit: ${qubits} qubits, ${depth} depth, ${gateCount} gates. Maximum computational power for complex simulations.`
      default:
        return ""
    }
  }

  /**
   * Calculates estimated runtime based on backend and circuit metrics
   */
  private static calculateEstimatedRuntime(backend: Backend, metrics: CircuitMetrics): number {
    const { qubits, depth, gateCount } = metrics

    // Base runtime factors (ms)
    const baseRuntimes = {
      quantum_inspired_gpu: 50,
      hpc_gpu: 30,
      quantum_qpu: 100,
    }

    // Calculate complexity factor
    const complexityFactor = (qubits * depth * Math.sqrt(gateCount)) / 100

    // Backend-specific runtime calculation
    const baseRuntime = baseRuntimes[backend]
    const estimatedRuntime = Math.round(baseRuntime * (1 + complexityFactor))

    return estimatedRuntime
  }

  /**
   * Validates circuit configuration before execution
   */
  static validateCircuitConfig(config: CircuitConfiguration): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (config.qubits < 1 || config.qubits > 50) {
      errors.push("Qubit count must be between 1 and 50")
    }

    if (config.depth < 1 || config.depth > 1000) {
      errors.push("Circuit depth must be between 1 and 1000")
    }

    if (config.shots < 1 || config.shots > 10000) {
      errors.push("Shot count must be between 1 and 10,000")
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }
}
