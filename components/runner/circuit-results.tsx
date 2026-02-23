"use client"

import { useState } from "react"
import { ChevronDown, Download, Brain, TrendingUp, Lightbulb, Info } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MetricGauge, CircularProgress, LinearMetric } from "@/components/ui/metric-gauge"

interface CircuitResultsProps {
  backend: string
  results?: any
  qubits: number
  onDownload?: () => void
}

export function CircuitResults({ backend, results, qubits, onDownload }: CircuitResultsProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)
  const [showDigitalTwinDetails, setShowDigitalTwinDetails] = useState(false)

  const backendNames = {
    quantum_inspired_gpu: "Quantum Inspired GPU",
    hpc_gpu: "HPC GPU",
    quantum_qpu: "Quantum QPU",
  }

  const benchmarks = results || {
    successRate: 96.4,
    runtime: 1.45,
    qubitsUsed: qubits,
    shots: 1024,
    fidelity: 98.2,
  }

  const digitalTwin = results?.digital_twin
  const hasDT = !!digitalTwin

  // Calculate reliability score (0-100)
  const getReliabilityScore = () => {
    const successRate = benchmarks.success_rate || benchmarks.successRate || 0
    const fidelity = benchmarks.fidelity || 95
    return Math.round((successRate + fidelity) / 2)
  }

  // Normalize error mitigation level to 0-100
  const getErrorMitigationLevel = () => {
    const em = results?.error_mitigation || "none"
    if (em === "high") return 100
    if (em === "medium") return 66
    if (em === "low") return 33
    return 0
  }

  // Normalize qubits to percentage (max 30 qubits)
  const getQubitUsagePercent = () => {
    const used = benchmarks.qubits_used || benchmarks.qubitsUsed || qubits
    return Math.min(100, (used / 30) * 100)
  }

  // Normalize runtime to performance score (lower is better, inverted)
  const getRuntimeScore = () => {
    const runtime = benchmarks.runtime_ms || benchmarks.runtime * 1000 || 0
    // 0-100ms = excellent (90-100), 100-500ms = good (70-89), 500-2000ms = fair (40-69), >2000ms = poor (0-39)
    if (runtime <= 100) return 95
    if (runtime <= 500) return 80
    if (runtime <= 2000) return 55
    return Math.max(20, 100 - runtime / 50)
  }

  const getMeasurementData = () => {
    if (results?.counts) {
      return Object.entries(results.counts)
        .map(([bitstring, count]: [string, any]) => ({
          bitstring,
          probability: count / (results.total_shots || 1024),
        }))
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 10)
    }
    return [
      { bitstring: "0110001", probability: 0.342 },
      { bitstring: "1001110", probability: 0.218 },
      { bitstring: "0011101", probability: 0.156 },
      { bitstring: "1100010", probability: 0.124 },
      { bitstring: "0000000", probability: 0.089 },
      { bitstring: "1111111", probability: 0.071 },
    ]
  }

  const measurementData = getMeasurementData()

  return (
    <Card className="p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <h2 className="text-2xl font-bold text-foreground">Execution Dashboard</h2>
          <ChevronDown
            size={24}
            className={`text-primary transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
          />
        </div>
        {onDownload && results && (
          <Button onClick={onDownload} size="sm" variant="outline" className="flex items-center gap-2 bg-transparent">
            <Download size={16} />
            Download
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="space-y-6">
          {/* Main Metrics Dashboard with Gauges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricGauge
              value={getReliabilityScore()}
              label="Reliability"
              unit="%"
              min={0}
              max={100}
            />
            <CircularProgress
              value={getQubitUsagePercent()}
              label="Qubit Usage"
              displayValue={`${benchmarks.qubits_used || benchmarks.qubitsUsed || qubits}`}
              maxLabel="/ 30"
            />
            <LinearMetric
              value={getErrorMitigationLevel()}
              label="Error Mitigation"
              displayValue={results?.error_mitigation || "none"}
              levels={["None", "Low", "Med", "High"]}
            />
            <MetricGauge
              value={getRuntimeScore()}
              label="Performance"
              unit=""
              min={0}
              max={100}
              subtitle={`${Math.round(benchmarks.runtime_ms || benchmarks.runtime * 1000 || 0)}ms`}
            />
          </div>

          {/* Quick Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-secondary/50 rounded-lg border border-border text-center">
              <p className="text-xs text-muted-foreground mb-1">Success Rate</p>
              <p className="text-2xl font-bold text-primary">
                {(benchmarks.success_rate || benchmarks.successRate || 0).toFixed(1)}%
              </p>
            </div>
            <div className="p-3 bg-secondary/50 rounded-lg border border-border text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Shots</p>
              <p className="text-2xl font-bold text-primary">{benchmarks.total_shots || benchmarks.shots || 1024}</p>
            </div>
            <div className="p-3 bg-secondary/50 rounded-lg border border-border text-center">
              <p className="text-xs text-muted-foreground mb-1">Backend</p>
              <p className="text-sm font-bold text-primary">
                {(backendNames[backend as keyof typeof backendNames] || backend).replace(" ", "\n")}
              </p>
            </div>
            <div className="p-3 bg-secondary/50 rounded-lg border border-border text-center">
              <p className="text-xs text-muted-foreground mb-1">Fidelity</p>
              <p className="text-2xl font-bold text-primary">
                {(benchmarks.fidelity || 95).toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Technical Details (Collapsible) */}
          <div>
            <Button
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              variant="outline"
              className="w-full flex items-center justify-between mb-3 bg-secondary/30 hover:bg-secondary/50 border-border"
            >
              <div className="flex items-center gap-2">
                <Info size={18} className="text-muted-foreground" />
                <span className="font-medium text-foreground">Technical Details</span>
              </div>
              <ChevronDown
                size={20}
                className={`text-muted-foreground transition-transform duration-300 ${showTechnicalDetails ? "rotate-180" : ""}`}
              />
            </Button>

            {showTechnicalDetails && (
              <div className="space-y-3 pl-2 border-l-2 border-border">
                {/* Backend Info */}
                <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                  <p className="text-sm font-semibold text-foreground mb-1">Backend Selection</p>
                  <p className="text-xs text-muted-foreground">
                    {backendNames[backend as keyof typeof backendNames] || backend}
                  </p>
                  {results?.backendReason && (
                    <p className="text-xs text-muted-foreground mt-1">{results.backendReason}</p>
                  )}
                  {results?.backendHint && results.backendHint !== backend && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Originally requested: {backendNames[results.backendHint as keyof typeof backendNames] || results.backendHint}
                    </p>
                  )}
                </div>

                {/* ML Tuning Info */}
                {results?.error_mitigation_requested === "auto" && (
                  <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                    <p className="text-sm font-semibold text-foreground mb-1">ML Auto-Tuning</p>
                    <p className="text-xs text-muted-foreground mb-1">
                      Error Mitigation: <span className="text-primary capitalize font-medium">{results.error_mitigation || "N/A"}</span>
                      <span className="text-muted-foreground ml-1">(auto-resolved by RL)</span>
                    </p>
                    {results.ml_tuning && (
                      <>
                        <p className="text-xs text-muted-foreground mt-1">{results.ml_tuning.reasoning}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Confidence: {(results.ml_tuning.confidence * 100).toFixed(0)}%
                          {results.ml_tuning.based_on_executions > 0 && ` • Based on ${results.ml_tuning.based_on_executions} prior executions`}
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* Runtime Details */}
                <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                  <p className="text-sm font-semibold text-foreground mb-1">Execution Details</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Runtime: </span>
                      <span className="text-foreground font-mono">
                        {Math.round(benchmarks.runtime_ms || benchmarks.runtime * 1000 || 0)}ms
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Qubits: </span>
                      <span className="text-foreground font-mono">
                        {benchmarks.qubits_used || benchmarks.qubitsUsed || qubits}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Shots: </span>
                      <span className="text-foreground font-mono">
                        {benchmarks.total_shots || benchmarks.shots || 1024}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Success: </span>
                      <span className="text-foreground font-mono">
                        {(benchmarks.success_rate || benchmarks.successRate || 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Digital Twin Insights (Collapsible) */}
          {hasDT && (
            <div>
              <Button
                onClick={() => setShowDigitalTwinDetails(!showDigitalTwinDetails)}
                variant="outline"
                className="w-full flex items-center justify-between mb-3 bg-primary/5 hover:bg-primary/10 border-primary/30"
              >
                <div className="flex items-center gap-2">
                  <Brain size={18} className="text-primary" />
                  <span className="font-medium text-foreground">Digital Twin Insights</span>
                </div>
                <ChevronDown
                  size={20}
                  className={`text-primary transition-transform duration-300 ${showDigitalTwinDetails ? "rotate-180" : ""}`}
                />
              </Button>

              {showDigitalTwinDetails && (
                <div className="space-y-3 pl-2 border-l-2 border-primary/30">
                  {/* Interpretation */}
                  {(digitalTwin.interpretation || digitalTwin.insights?.interpretation) && (
                    <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb size={16} className="text-primary" />
                        <p className="text-sm font-semibold text-foreground">Interpretation</p>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {digitalTwin.interpretation || digitalTwin.insights?.interpretation}
                      </p>
                    </div>
                  )}

                  {/* Behavior Insights */}
                  {((digitalTwin.behavior_insights && digitalTwin.behavior_insights.length > 0) ||
                    (digitalTwin.insights?.key_findings && digitalTwin.insights.key_findings.length > 0)) && (
                    <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp size={16} className="text-primary" />
                        <p className="text-sm font-semibold text-foreground">Key Findings</p>
                      </div>
                      <ul className="space-y-1">
                        {(digitalTwin.behavior_insights || digitalTwin.insights?.key_findings || []).map((finding: string, idx: number) => (
                          <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2 leading-relaxed">
                            <span className="text-primary mt-0.5">•</span>
                            <span>{finding}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Performance Metrics */}
                  {digitalTwin.performance_metrics && (
                    <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                      <p className="text-sm font-semibold text-foreground mb-2">Performance Metrics</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "Speed", value: digitalTwin.performance_metrics.executionSpeed },
                          { label: "Convergence", value: digitalTwin.performance_metrics.convergence },
                          { label: "Reliability", value: digitalTwin.performance_metrics.reliability },
                        ].map((m) => {
                          const color = m.value === "excellent" || m.value === "strong" || m.value === "high"
                            ? "text-green-400" : m.value === "good" || m.value === "moderate" || m.value === "medium"
                              ? "text-yellow-400" : "text-red-400"
                          return (
                            <div key={m.label} className="text-center p-2 bg-secondary/50 rounded">
                              <div className="text-xs text-muted-foreground">{m.label}</div>
                              <div className={`text-xs font-bold capitalize ${color}`}>{m.value}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Statistical Analysis */}
                  {digitalTwin.statistical_analysis && (
                    <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                      <p className="text-sm font-semibold text-foreground mb-2">Statistical Analysis</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-xs">
                          <span className="text-muted-foreground">Entropy: </span>
                          <span className="font-mono text-foreground">
                            {digitalTwin.statistical_analysis.entropy?.toFixed(2)} bits
                          </span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Convergence: </span>
                          <span className="font-mono text-foreground capitalize">
                            {digitalTwin.statistical_analysis.convergence}
                          </span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Unique States: </span>
                          <span className="font-mono text-foreground">
                            {digitalTwin.statistical_analysis.unique_outcomes}
                          </span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Std Dev: </span>
                          <span className="font-mono text-foreground">
                            {digitalTwin.statistical_analysis.std_probability?.toFixed(4)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Data Patterns */}
                  {((digitalTwin.data_patterns && digitalTwin.data_patterns.length > 0) ||
                    (digitalTwin.insights?.data_patterns && digitalTwin.insights.data_patterns.length > 0)) && (
                    <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                      <p className="text-sm font-semibold text-foreground mb-2">Data Patterns</p>
                      <ul className="space-y-1">
                        {(digitalTwin.data_patterns || digitalTwin.insights?.data_patterns || []).map((pattern: string, idx: number) => (
                          <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2 leading-relaxed">
                            <span className="text-primary mt-0.5">•</span>
                            <span>{pattern}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommendations */}
                  {((digitalTwin.system_recommendations && digitalTwin.system_recommendations.length > 0) ||
                    (digitalTwin.insights?.recommendations && digitalTwin.insights.recommendations.length > 0)) && (
                    <div className="p-3 bg-primary/10 rounded-lg border border-primary/30">
                      <p className="text-sm font-semibold text-foreground mb-2">System Recommendations</p>
                      <ul className="space-y-1">
                        {(digitalTwin.system_recommendations || digitalTwin.insights?.recommendations || []).map((rec: string, idx: number) => (
                          <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2 leading-relaxed">
                            <span className="text-primary mt-0.5">→</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Measurement Probabilities */}
          <div>
            <p className="text-sm font-medium text-foreground mb-3">Measurement Probabilities</p>
            <div className="space-y-2 min-h-64 max-h-96 overflow-auto">
              {measurementData.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 bg-secondary/30 rounded border border-border hover:bg-secondary/40 transition-colors"
                >
                  <code className="text-sm font-mono text-foreground">{item.bitstring}</code>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-secondary rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${item.probability * 100}%` }} />
                    </div>
                    <span className="text-sm font-medium text-primary w-12 text-right">
                      {(item.probability * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
