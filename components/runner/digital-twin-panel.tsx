"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Brain, ChevronDown, TrendingUp, Activity, Lightbulb, GitBranch, Zap, Target, AlertCircle } from "lucide-react"

interface DigitalTwinPanelProps {
  algorithm: string
  inputData: any
  circuitInfo: {
    qubits: number
    depth: number
    gates: any[]
    qasm: string
  }
  executionResults: {
    counts: Record<string, number>
    shots: number
    success_rate: number
    runtime_ms: number
  }
  backendConfig: {
    backend: string
    error_mitigation: string
    transpiled: boolean
  }
}

export function DigitalTwinPanel({
  algorithm,
  inputData,
  circuitInfo,
  executionResults,
  backendConfig,
}: DigitalTwinPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [activeTab, setActiveTab] = useState<"overview" | "analysis" | "recommendations">("overview")

  const generateDigitalTwin = () => {
    // Calculate statistical metrics
    const probabilities = Object.entries(executionResults.counts).map(([state, count]) => ({
      state,
      probability: count / executionResults.shots,
    }))
    probabilities.sort((a, b) => b.probability - a.probability)

    const entropy = -probabilities.reduce((sum, { probability }) => {
      return sum + (probability > 0 ? probability * Math.log2(probability) : 0)
    }, 0)

    const topStates = probabilities.slice(0, 5)
    const dominantState = topStates[0]
    const uniformity = entropy / circuitInfo.qubits

    // Algorithm-specific interpretation
    let algorithmInterpretation = ""
    let behaviorInsights: string[] = []
    let systemRecommendations: string[] = []

    switch (algorithm.toLowerCase()) {
      case "bell":
        algorithmInterpretation =
          "Bell state circuit demonstrates quantum entanglement between qubits. The system creates maximally entangled pairs showing perfect correlation."
        behaviorInsights = [
          `Entanglement fidelity: ${(dominantState.probability * 100).toFixed(2)}%`,
          `Detected ${topStates.length} primary quantum states with ${uniformity.toFixed(2)} distribution uniformity`,
          `Circuit depth of ${circuitInfo.depth} gates maintains coherence across ${circuitInfo.qubits} qubits`,
        ]
        systemRecommendations = [
          uniformity < 0.5
            ? "Low entropy suggests strong entanglement - consider adding more qubits for complex correlations"
            : "High entropy indicates decoherence - reduce circuit depth or increase error mitigation",
          backendConfig.error_mitigation === "none"
            ? "Enable error mitigation to improve Bell state fidelity"
            : "Current error mitigation preserves quantum correlations effectively",
        ]
        break

      case "grover":
        algorithmInterpretation =
          "Grover's algorithm performs quantum search with quadratic speedup. The Digital Twin models the amplitude amplification process and convergence to target states."
        behaviorInsights = [
          `Search success rate: ${executionResults.success_rate.toFixed(2)}% - ${dominantState.state} is the marked state`,
          `Optimal iterations achieved with ${circuitInfo.depth} oracle calls for ${circuitInfo.qubits} qubits`,
          `Amplitude amplification factor: ${(dominantState.probability / (1 / Math.pow(2, circuitInfo.qubits))).toFixed(2)}x`,
        ]
        systemRecommendations = [
          executionResults.success_rate > 90
            ? "Excellent convergence - the oracle and diffusion operators are well-calibrated"
            : "Consider adjusting iteration count: optimal is ~π/4 * √(2^n) for n qubits",
          inputData
            ? `Input data size suggests ${Math.ceil(Math.log2(inputData.length || 1))} qubits minimum`
            : "Provide structured input data for more accurate search target identification",
        ]
        break

      case "shor":
        algorithmInterpretation =
          "Shor's algorithm demonstrates quantum factorization using period finding. The Digital Twin tracks quantum Fourier transform behavior and phase estimation accuracy."
        behaviorInsights = [
          `Period detection probability: ${(dominantState.probability * 100).toFixed(2)}%`,
          `QFT precision with ${circuitInfo.qubits} qubits enables factorization of ${Math.pow(2, circuitInfo.qubits / 2)}-bit numbers`,
          `Phase estimation converged after ${executionResults.runtime_ms.toFixed(3)}ms with ${executionResults.shots} measurements`,
        ]
        systemRecommendations = [
          circuitInfo.qubits < 8
            ? "Increase qubit count to 8+ for practical factorization demonstrations"
            : "Qubit count is sufficient for demonstrating period-finding on larger composite numbers",
          "Consider implementing modular exponentiation optimization for faster execution",
        ]
        break

      case "vqe":
        algorithmInterpretation =
          "Variational Quantum Eigensolver optimizes quantum states to find ground state energies. The Digital Twin monitors convergence patterns and energy landscape exploration."
        behaviorInsights = [
          `Energy convergence rate: ${(executionResults.success_rate / 100).toFixed(4)} per iteration`,
          `Ansatz depth of ${circuitInfo.depth} provides ${Math.pow(2, circuitInfo.qubits)} parameter dimensions`,
          `State preparation entropy: ${entropy.toFixed(3)} bits indicates ${uniformity > 0.7 ? "broad" : "focused"} energy landscape sampling`,
        ]
        systemRecommendations = [
          entropy > 2
            ? "High entropy suggests the optimizer is exploring - increase iterations or adjust learning rate"
            : "Low entropy indicates convergence - consider different initial parameters to avoid local minima",
          backendConfig.error_mitigation !== "none"
            ? "Error mitigation active - critical for accurate energy estimation"
            : "Enable error mitigation to reduce measurement noise in energy calculations",
        ]
        break

      case "qaoa":
        algorithmInterpretation =
          "Quantum Approximate Optimization Algorithm solves combinatorial problems using alternating problem and mixer Hamiltonians. The Digital Twin analyzes optimization trajectory and solution quality."
        behaviorInsights = [
          `Solution approximation ratio: ${(executionResults.success_rate / 100).toFixed(3)}`,
          `Circuit layers (p=${Math.floor(circuitInfo.depth / 2)}): ${circuitInfo.depth / 2 > 5 ? "deep exploration" : "shallow approximation"}`,
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

      default:
        algorithmInterpretation = `Custom quantum algorithm with ${circuitInfo.qubits} qubits and ${circuitInfo.depth} gate depth. The Digital Twin provides general quantum behavior analysis.`
        behaviorInsights = [
          `Measurement entropy: ${entropy.toFixed(3)} bits`,
          `Top measurement outcome: ${dominantState.state} (${(dominantState.probability * 100).toFixed(2)}%)`,
          `State space exploration: ${probabilities.length} unique outcomes from ${executionResults.shots} shots`,
        ]
        systemRecommendations = [
          "Analyze gate composition to understand quantum state evolution",
          uniformity > 0.8 ? "High uniformity - circuit may need more structure" : "Good state concentration observed",
        ]
    }

    // Data patterns from input
    const dataPatterns: string[] = []
    if (inputData) {
      if (Array.isArray(inputData)) {
        dataPatterns.push(`Input dataset contains ${inputData.length} data points`)
        if (inputData.length > 0 && typeof inputData[0] === "number") {
          const avgValue = inputData.reduce((a: number, b: number) => a + b, 0) / inputData.length
          dataPatterns.push(`Average input value: ${avgValue.toFixed(2)}`)
        }
      } else if (typeof inputData === "object") {
        const keys = Object.keys(inputData)
        dataPatterns.push(
          `Input contains ${keys.length} features: ${keys.slice(0, 3).join(", ")}${keys.length > 3 ? "..." : ""}`,
        )
      }
    }

    // Circuit topology insights
    const topologyInsights = [
      `Circuit compiled for ${backendConfig.backend.replace(/_/g, " ")} backend`,
      backendConfig.transpiled
        ? "Transpilation optimized gate sequence for hardware topology"
        : "Direct compilation without transpilation",
      `Gate count: ${circuitInfo.gates.length} | Qubit utilization: ${((circuitInfo.qubits / 16) * 100).toFixed(1)}% of typical QPU`,
    ]

    // Performance metrics
    const performanceMetrics = {
      executionSpeed:
        executionResults.runtime_ms < 100 ? "excellent" : executionResults.runtime_ms < 500 ? "good" : "acceptable",
      convergence:
        executionResults.success_rate > 90 ? "strong" : executionResults.success_rate > 70 ? "moderate" : "weak",
      reliability: uniformity < 0.5 ? "high" : uniformity < 0.8 ? "medium" : "low",
    }

    return {
      interpretation: algorithmInterpretation,
      behaviorInsights,
      dataPatterns,
      topologyInsights,
      systemRecommendations,
      performanceMetrics,
      quantumMetrics: {
        entropy,
        uniformity,
        topStates: topStates.slice(0, 3),
        stateSpace: probabilities.length,
      },
    }
  }

  const digitalTwin = generateDigitalTwin()

  const tabs = [
    { id: "overview", label: "Overview", icon: Brain },
    { id: "analysis", label: "Analysis", icon: Activity },
    { id: "recommendations", label: "Recommendations", icon: Lightbulb },
  ] as const

  return (
    <Card className="p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-2">
          <Brain className="text-primary" size={24} />
          <h2 className="text-2xl font-bold text-foreground">Digital Twin</h2>
        </div>
        <ChevronDown
          size={24}
          className={`text-primary transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
        />
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-border pb-2">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2"
              >
                <tab.icon size={16} />
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Algorithm Interpretation */}
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
                <div className="flex items-center gap-2 mb-2">
                  <Target size={18} className="text-primary" />
                  <h3 className="font-semibold text-foreground">Algorithm Behavior</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{digitalTwin.interpretation}</p>
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-secondary/50 rounded-lg border border-border text-center">
                  <div className="text-xs text-muted-foreground mb-1">Execution Speed</div>
                  <div className="text-lg font-bold text-primary capitalize">
                    {digitalTwin.performanceMetrics.executionSpeed}
                  </div>
                </div>
                <div className="p-3 bg-secondary/50 rounded-lg border border-border text-center">
                  <div className="text-xs text-muted-foreground mb-1">Convergence</div>
                  <div className="text-lg font-bold text-primary capitalize">
                    {digitalTwin.performanceMetrics.convergence}
                  </div>
                </div>
                <div className="p-3 bg-secondary/50 rounded-lg border border-border text-center">
                  <div className="text-xs text-muted-foreground mb-1">Reliability</div>
                  <div className="text-lg font-bold text-primary capitalize">
                    {digitalTwin.performanceMetrics.reliability}
                  </div>
                </div>
              </div>

              {/* Quantum Metrics */}
              <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Zap size={18} className="text-primary" />
                  <h3 className="font-semibold text-foreground">Quantum Metrics</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Entropy: </span>
                    <span className="font-mono text-primary">{digitalTwin.quantumMetrics.entropy.toFixed(3)} bits</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Uniformity: </span>
                    <span className="font-mono text-primary">{digitalTwin.quantumMetrics.uniformity.toFixed(3)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">State Space: </span>
                    <span className="font-mono text-primary">{digitalTwin.quantumMetrics.stateSpace} states</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Top States: </span>
                    <span className="font-mono text-primary">{digitalTwin.quantumMetrics.topStates.length}</span>
                  </div>
                </div>
              </div>

              {/* Top Quantum States */}
              <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                <h3 className="font-semibold text-foreground mb-3">Dominant Quantum States</h3>
                <div className="space-y-2">
                  {digitalTwin.quantumMetrics.topStates.map((state, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <code className="font-mono text-foreground bg-secondary/50 px-2 py-1 rounded">{state.state}</code>
                      <div className="flex items-center gap-3 flex-1 ml-3">
                        <div className="flex-1 bg-secondary rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-500"
                            style={{ width: `${state.probability * 100}%` }}
                          />
                        </div>
                        <span className="font-medium text-primary w-16 text-right">
                          {(state.probability * 100).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Analysis Tab */}
          {activeTab === "analysis" && (
            <div className="space-y-4">
              {/* Behavior Insights */}
              <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={18} className="text-primary" />
                  <h3 className="font-semibold text-foreground">Behavior Insights</h3>
                </div>
                <ul className="space-y-2">
                  {digitalTwin.behaviorInsights.map((insight, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-1 font-bold">•</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Data Patterns */}
              {digitalTwin.dataPatterns.length > 0 && (
                <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <GitBranch size={18} className="text-primary" />
                    <h3 className="font-semibold text-foreground">Input Data Patterns</h3>
                  </div>
                  <ul className="space-y-2">
                    {digitalTwin.dataPatterns.map((pattern, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-1 font-bold">•</span>
                        <span>{pattern}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Circuit Topology */}
              <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Activity size={18} className="text-primary" />
                  <h3 className="font-semibold text-foreground">Circuit Topology</h3>
                </div>
                <ul className="space-y-2">
                  {digitalTwin.topologyInsights.map((insight, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-1 font-bold">•</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Recommendations Tab */}
          {activeTab === "recommendations" && (
            <div className="space-y-4">
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle size={18} className="text-primary" />
                  <h3 className="font-semibold text-foreground">System Recommendations</h3>
                </div>
                <ul className="space-y-3">
                  {digitalTwin.systemRecommendations.map((rec, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-muted-foreground flex items-start gap-2 p-3 bg-background/50 rounded border border-border"
                    >
                      <span className="text-primary mt-0.5 font-bold">→</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Optimization Suggestions */}
              <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                <h3 className="font-semibold text-foreground mb-3">Optimization Opportunities</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <span className="text-primary mt-1">▸</span>
                    <span>
                      Current runtime: {executionResults.runtime_ms.toFixed(3)}ms -{" "}
                      {executionResults.runtime_ms < 100
                        ? "optimal performance achieved"
                        : "consider reducing circuit depth or shots for faster execution"}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-primary mt-1">▸</span>
                    <span>
                      Success rate: {executionResults.success_rate.toFixed(2)}% -{" "}
                      {executionResults.success_rate > 90
                        ? "excellent convergence"
                        : "increase shots or adjust algorithm parameters"}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-primary mt-1">▸</span>
                    <span>
                      Error mitigation: {backendConfig.error_mitigation} -{" "}
                      {backendConfig.error_mitigation === "none"
                        ? "enable for improved accuracy on noisy backends"
                        : "currently protecting against decoherence"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
