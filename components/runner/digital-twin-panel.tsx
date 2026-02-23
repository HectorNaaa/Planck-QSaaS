"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Brain, ChevronDown, ChevronUp, Info } from "lucide-react"
import { MetricGauge, LevelIndicator } from "@/components/ui/metric-gauge"

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
  showDominantStates?: boolean
}

export function DigitalTwinPanel({
  algorithm,
  inputData,
  circuitInfo,
  executionResults,
  backendConfig,
  showDominantStates = false,
}: DigitalTwinPanelProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)

  const generateDigitalTwin = () => {
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

    // Error mitigation level mapping
    const errorMitigationLevel = backendConfig.error_mitigation === "none" ? "none" :
      backendConfig.error_mitigation === "low" ? "low" :
      backendConfig.error_mitigation === "medium" ? "medium" : "high"

    // Performance metrics
    const performanceMetrics = {
      executionSpeed: executionResults.runtime_ms < 100 ? "excellent" : executionResults.runtime_ms < 500 ? "good" : "acceptable",
      convergence: executionResults.success_rate > 90 ? "strong" : executionResults.success_rate > 70 ? "moderate" : "weak",
      reliability: uniformity < 0.5 ? "high" : uniformity < 0.8 ? "medium" : "low",
    }

    // Algorithm-specific interpretation (kept for technical details)
    let algorithmInterpretation = `${algorithm} algorithm executed with ${circuitInfo.qubits} qubits and ${circuitInfo.depth}-gate depth circuit.`
    let behaviorInsights: string[] = []
    let systemRecommendations: string[] = []

    switch (algorithm.toLowerCase()) {
      case "bell":
        algorithmInterpretation = "Bell state circuit demonstrates quantum entanglement between qubits."
        behaviorInsights = [
          `Entanglement fidelity: ${(dominantState.probability * 100).toFixed(2)}%`,
          `${topStates.length} primary quantum states detected`,
          `Circuit depth: ${circuitInfo.depth} gates across ${circuitInfo.qubits} qubits`,
        ]
        systemRecommendations = [
          uniformity < 0.5 ? "Consider adding more qubits for complex correlations" : "Consider reducing circuit depth",
          backendConfig.error_mitigation === "none" ? "Enable error mitigation to improve fidelity" : "Error mitigation is preserving quantum correlations",
        ]
        break

      case "grover":
        algorithmInterpretation = "Grover's search algorithm with quadratic speedup over classical search."
        behaviorInsights = [
          `Search success rate: ${executionResults.success_rate.toFixed(2)}%`,
          `Marked state: ${dominantState.state}`,
          `Amplitude amplification: ${(dominantState.probability / (1 / Math.pow(2, circuitInfo.qubits))).toFixed(2)}x`,
        ]
        systemRecommendations = [
          executionResults.success_rate > 90 ? "Excellent convergence achieved" : "Consider adjusting iteration count",
          inputData ? `${Math.ceil(Math.log2(inputData.length || 1))} qubits recommended for input size` : "Provide structured input data",
        ]
        break

      case "vqe":
        algorithmInterpretation = "Variational Quantum Eigensolver for ground state energy optimization."
        behaviorInsights = [
          `Convergence rate: ${(executionResults.success_rate / 100).toFixed(4)}`,
          `Parameter dimensions: ${Math.pow(2, circuitInfo.qubits)}`,
          `Entropy: ${entropy.toFixed(3)} bits (${uniformity > 0.7 ? "broad" : "focused"} sampling)`,
        ]
        systemRecommendations = [
          entropy > 2 ? "Increase iterations or adjust learning rate" : "Consider different initial parameters to avoid local minima",
          backendConfig.error_mitigation !== "none" ? "Error mitigation active for accuracy" : "Enable error mitigation for better results",
        ]
        break

      default:
        behaviorInsights = [
          `Measurement entropy: ${entropy.toFixed(3)} bits`,
          `Top outcome: ${dominantState.state} (${(dominantState.probability * 100).toFixed(2)}%)`,
          `${probabilities.length} unique outcomes observed`,
        ]
        systemRecommendations = [
          "Analyze gate composition for optimization opportunities",
          uniformity > 0.8 ? "Consider adding structure to circuit" : "Good state concentration observed",
        ]
    }

    return {
      interpretation: algorithmInterpretation,
      behaviorInsights,
      systemRecommendations,
      performanceMetrics,
      errorMitigationLevel,
      metrics: {
        successRate: executionResults.success_rate,
        runtime: executionResults.runtime_ms,
        qubitsUsed: circuitInfo.qubits,
        circuitDepth: circuitInfo.depth,
        entropy,
        uniformity,
        topStates: topStates.slice(0, 3),
      },
    }
  }

  const digitalTwin = generateDigitalTwin()

  // Calculate gauge values (0-100 scale)
  const successGaugeValue = digitalTwin.metrics.successRate
  const runtimeGaugeValue = Math.min(100, 100 - (digitalTwin.metrics.runtime / 10)) // Lower is better, inverted
  const qubitUtilization = (digitalTwin.metrics.qubitsUsed / 30) * 100 // Max 30 qubits
  const circuitComplexity = Math.min(100, (digitalTwin.metrics.circuitDepth / 100) * 100)
  const entropyNormalized = Math.min(100, (digitalTwin.metrics.entropy / 5) * 100) // Max ~5 bits

  return (
    <Card className="p-6 shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <Brain className="text-primary" size={32} />
        <div>
          <h2 className="text-2xl font-bold text-foreground">Digital Twin Dashboard</h2>
          <p className="text-xs text-muted-foreground">Real-time quantum simulation monitoring</p>
        </div>
      </div>

      {/* Primary Metrics Dashboard */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <MetricGauge 
          value={successGaugeValue} 
          label="Success Rate" 
          size="md"
          color={successGaugeValue > 80 ? "green" : successGaugeValue > 50 ? "yellow" : "red"}
          showValue
        />
        <MetricGauge 
          value={runtimeGaugeValue} 
          label="Performance" 
          size="md"
          color={runtimeGaugeValue > 70 ? "green" : runtimeGaugeValue > 40 ? "yellow" : "red"}
          showValue
        />
        <MetricGauge 
          value={qubitUtilization} 
          label="Qubit Usage" 
          size="md"
          color="blue"
          showValue
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <LevelIndicator 
          level={digitalTwin.performanceMetrics.executionSpeed as any} 
          label="Speed" 
          size="sm"
        />
        <LevelIndicator 
          level={digitalTwin.performanceMetrics.convergence as any} 
          label="Convergence" 
          size="sm"
        />
        <LevelIndicator 
          level={digitalTwin.performanceMetrics.reliability as any} 
          label="Reliability" 
          size="sm"
        />
        <LevelIndicator 
          level={digitalTwin.errorMitigationLevel as any} 
          label="Error Mitigation" 
          size="sm"
        />
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center justify-center h-6 w-full">
            <span className="text-2xl font-bold text-primary">{digitalTwin.metrics.qubitsUsed}</span>
          </div>
          <p className="text-[10px] text-muted-foreground text-center font-medium">Qubits</p>
        </div>
      </div>

      {/* Compact Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 bg-secondary/30 rounded-lg border border-border text-center">
          <p className="text-xs text-muted-foreground mb-1">Circuit Depth</p>
          <p className="text-lg font-bold text-foreground">{digitalTwin.metrics.circuitDepth}</p>
        </div>
        <div className="p-3 bg-secondary/30 rounded-lg border border-border text-center">
          <p className="text-xs text-muted-foreground mb-1">Entropy</p>
          <p className="text-lg font-bold text-foreground">{digitalTwin.metrics.entropy.toFixed(2)}</p>
        </div>
        <div className="p-3 bg-secondary/30 rounded-lg border border-border text-center">
          <p className="text-xs text-muted-foreground mb-1">Runtime</p>
          <p className="text-lg font-bold text-foreground">{digitalTwin.metrics.runtime.toFixed(0)}ms</p>
        </div>
      </div>

      {/* Dominant States - if enabled */}
      {showDominantStates && (
        <div className="mb-4 p-4 bg-secondary/30 rounded-lg border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-3">Dominant Quantum States</h3>
          <div className="space-y-2">
            {digitalTwin.metrics.topStates.map((state, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <code className="text-xs font-mono bg-secondary px-2 py-1 rounded">{state.state}</code>
                <div className="flex-1 bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-500"
                    style={{ width: `${state.probability * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-primary w-14 text-right">
                  {(state.probability * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Technical Details Toggle */}
      <Button
        onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
        variant="outline"
        size="sm"
        className="w-full flex items-center justify-center gap-2"
      >
        <Info size={14} />
        {showTechnicalDetails ? "Hide" : "View"} Technical Details
        {showTechnicalDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </Button>

      {/* Technical Details Section */}
      {showTechnicalDetails && (
        <div className="mt-4 space-y-4 pt-4 border-t border-border">
          {/* Interpretation */}
          <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
            <h3 className="text-sm font-semibold text-foreground mb-2">Algorithm Interpretation</h3>
            <p className="text-sm text-muted-foreground">{digitalTwin.interpretation}</p>
          </div>

          {/* Behavior Insights */}
          <div className="p-4 bg-secondary/30 rounded-lg border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-2">Behavior Insights</h3>
            <ul className="space-y-1">
              {digitalTwin.behaviorInsights.map((insight, idx) => (
                <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Recommendations */}
          <div className="p-4 bg-secondary/30 rounded-lg border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-2">System Recommendations</h3>
            <ul className="space-y-1">
              {digitalTwin.systemRecommendations.map((rec, idx) => (
                <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">→</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Circuit Topology */}
          <div className="p-4 bg-secondary/30 rounded-lg border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-2">Circuit Configuration</h3>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>• Backend: {backendConfig.backend.replace(/_/g, " ")}</p>
              <p>• Error Mitigation: {backendConfig.error_mitigation}</p>
              <p>• Transpiled: {backendConfig.transpiled ? "Yes" : "No"}</p>
              <p>• Gate Count: {circuitInfo.gates.length}</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
