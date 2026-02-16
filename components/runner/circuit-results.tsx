"use client"

import { useState } from "react"
import { ChevronDown, Download, Brain, TrendingUp, Lightbulb } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface CircuitResultsProps {
  backend: string
  results?: any
  qubits: number
  onDownload?: () => void
}

export function CircuitResults({ backend, results, qubits, onDownload }: CircuitResultsProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [showDigitalTwin, setShowDigitalTwin] = useState(false)

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
          <h2 className="text-2xl font-bold text-foreground">Circuit Results</h2>
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
        <div className="space-y-4">
          {/* Backend Info */}
          <div className="p-3 bg-primary/10 rounded-lg border border-primary space-y-1">
            <p className="text-sm font-medium text-foreground">
              Backend: {backendNames[backend as keyof typeof backendNames] || backend}
            </p>
            {results?.backendReason && (
              <p className="text-xs text-muted-foreground">{results.backendReason}</p>
            )}
            {results?.backendHint && results.backendHint !== backend && (
              <p className="text-xs text-muted-foreground">
                Requested: {backendNames[results.backendHint as keyof typeof backendNames] || results.backendHint}
              </p>
            )}
          </div>

          {/* Benchmarks */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-secondary/50 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">Success Rate</p>
              <p className="text-xl font-bold text-primary">
                {(benchmarks.success_rate || benchmarks.successRate || 0).toFixed(1)}%
              </p>
            </div>
            <div className="p-3 bg-secondary/50 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">Runtime</p>
              <p className="text-xl font-bold text-primary">
                {Math.round(benchmarks.runtime_ms || benchmarks.runtime * 1000 || 0)}ms
              </p>
            </div>
            <div className="p-3 bg-secondary/50 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">Qubits Used</p>
              <p className="text-xl font-bold text-primary">
                {benchmarks.qubits_used || benchmarks.qubitsUsed || qubits}
              </p>
            </div>
            <div className="p-3 bg-secondary/50 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">Total Shots</p>
              <p className="text-xl font-bold text-primary">{benchmarks.total_shots || benchmarks.shots || 1024}</p>
            </div>
          </div>

          {hasDT && (
            <div className="mt-4">
              <Button
                onClick={() => setShowDigitalTwin(!showDigitalTwin)}
                variant="outline"
                className="w-full flex items-center justify-between mb-3 bg-primary/5 hover:bg-primary/10 border-primary/30"
              >
                <div className="flex items-center gap-2">
                  <Brain size={18} className="text-primary" />
                  <span className="font-medium">Digital Twin Insights</span>
                </div>
                <ChevronDown
                  size={20}
                  className={`text-primary transition-transform duration-300 ${showDigitalTwin ? "rotate-180" : ""}`}
                />
              </Button>

              {showDigitalTwin && (
                <div className="space-y-4 pl-2 border-l-2 border-primary/30">
                  {/* Interpretation */}
                  {digitalTwin.insights?.interpretation && (
                    <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb size={16} className="text-primary" />
                        <p className="text-sm font-semibold text-foreground">Interpretation</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{digitalTwin.insights.interpretation}</p>
                    </div>
                  )}

                  {/* Key Findings */}
                  {digitalTwin.insights?.key_findings && digitalTwin.insights.key_findings.length > 0 && (
                    <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp size={16} className="text-primary" />
                        <p className="text-sm font-semibold text-foreground">Key Findings</p>
                      </div>
                      <ul className="space-y-1">
                        {digitalTwin.insights.key_findings.map((finding: string, idx: number) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-primary mt-1">•</span>
                            <span>{finding}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Data Patterns */}
                  {digitalTwin.insights?.data_patterns && digitalTwin.insights.data_patterns.length > 0 && (
                    <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                      <p className="text-sm font-semibold text-foreground mb-2">Data Patterns</p>
                      <ul className="space-y-1">
                        {digitalTwin.insights.data_patterns.map((pattern: string, idx: number) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-primary mt-1">•</span>
                            <span>{pattern}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Statistical Analysis */}
                  {digitalTwin.statistical_analysis && (
                    <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                      <p className="text-sm font-semibold text-foreground mb-3">Statistical Analysis</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-xs">
                          <span className="text-muted-foreground">Entropy: </span>
                          <span className="font-mono text-primary">
                            {digitalTwin.statistical_analysis.entropy?.toFixed(2)} bits
                          </span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Convergence: </span>
                          <span className="font-mono text-primary capitalize">
                            {digitalTwin.statistical_analysis.convergence}
                          </span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Unique States: </span>
                          <span className="font-mono text-primary">
                            {digitalTwin.statistical_analysis.unique_outcomes}
                          </span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Std Dev: </span>
                          <span className="font-mono text-primary">
                            {digitalTwin.statistical_analysis.std_probability?.toFixed(4)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {digitalTwin.insights?.recommendations && digitalTwin.insights.recommendations.length > 0 && (
                    <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
                      <p className="text-sm font-semibold text-foreground mb-2">Recommendations</p>
                      <ul className="space-y-1">
                        {digitalTwin.insights.recommendations.map((rec: string, idx: number) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-primary mt-1">→</span>
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
          <div className="mt-4">
            <p className="text-sm font-medium text-foreground mb-3">Measurement Probabilities</p>
            <div className="space-y-2 min-h-64 max-h-96 overflow-auto">
              {measurementData.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 bg-secondary/30 rounded border border-border"
                >
                  <code className="text-sm font-mono text-foreground">{item.bitstring}</code>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-secondary rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{ width: `${item.probability * 100}%` }} />
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
