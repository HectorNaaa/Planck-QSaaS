"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronDown, Download, Brain, TrendingUp, Lightbulb, Info } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MetricGauge, LinearMetric } from "@/components/ui/metric-gauge"

interface CircuitResultsProps {
  backend: string
  results?: any
  qubits: number
  onDownload?: () => void
  /** When true (SDK / live mode) numbers animate on change */
  isLive?: boolean
}

/** Smoothly counts from `prev` to `next` over ~600 ms using rAF */
function useAnimatedValue(next: number, isLive?: boolean): number {
  const [display, setDisplay] = useState(next)
  const rafRef = useRef<number>(0)
  const startRef = useRef<number>(0)
  const fromRef = useRef<number>(next)

  useEffect(() => {
    if (!isLive) { setDisplay(next); return }
    cancelAnimationFrame(rafRef.current)
    const from = fromRef.current
    const duration = 600
    startRef.current = performance.now()
    const animate = (now: number) => {
      const t = Math.min((now - startRef.current) / duration, 1)
      // ease-out cubic
      const ease = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (next - from) * ease))
      if (t < 1) rafRef.current = requestAnimationFrame(animate)
      else fromRef.current = next
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [next, isLive])

  return display
}

/** Returns a flash CSS class whenever `value` changes */
function useFlash(value: number, isLive?: boolean): string {
  const [flash, setFlash] = useState(false)
  const prev = useRef(value)
  useEffect(() => {
    if (!isLive || value === prev.current) return
    prev.current = value
    setFlash(true)
    const t = setTimeout(() => setFlash(false), 700)
    return () => clearTimeout(t)
  }, [value, isLive])
  return flash ? "ring-2 ring-primary/50 shadow-[0_0_12px_2px_var(--primary)] transition-shadow" : "transition-shadow"
}

export function CircuitResults({ backend, results, qubits, onDownload, isLive }: CircuitResultsProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)
  const [showDigitalTwinDetails, setShowDigitalTwinDetails] = useState(false)

  const backendNames: Record<string, string> = {
    quantum_inspired_gpu: "Quantum Inspired GPU",
    hpc_gpu: "HPC GPU",
    quantum_qpu: "Quantum QPU",
  }

  const b = results || {}
  const successRateRaw  = Math.round(b.success_rate  ?? b.successRate  ?? 0)
  const totalShotsRaw   = b.total_shots ?? b.shots ?? 0
  const qubitsUsedRaw   = results ? (b.qubits_used ?? b.qubitsUsed ?? qubits) : 0
  const fidelityRaw     = results ? Math.round(b.fidelity ?? 95) : 0
  const runtimeMsRaw    = Math.round(b.runtime_ms ?? (b.runtime ?? 0) * 1000)
  const emLevel         = results?.error_mitigation ?? "none"

  // Animated display values (count-up on change in live mode)
  const successRate = useAnimatedValue(successRateRaw, isLive)
  const totalShots  = useAnimatedValue(totalShotsRaw,  isLive)
  const qubitsUsed  = useAnimatedValue(qubitsUsedRaw,  isLive)
  const fidelity    = useAnimatedValue(fidelityRaw,    isLive)
  const runtimeMs   = useAnimatedValue(runtimeMsRaw,   isLive)

  // Flash ring on value change
  const srFlash       = useFlash(successRateRaw, isLive)
  const shotsFlash    = useFlash(totalShotsRaw,  isLive)
  const runtimeFlash  = useFlash(runtimeMsRaw,   isLive)

  const digitalTwin  = results?.digital_twin
  const hasDT        = !!digitalTwin

  // Gauge scores — use animated values so needles sweep smoothly in live mode
  const reliabilityScore = Math.round((successRate + fidelity) / 2)
  const perfScore = !results ? 0
    : runtimeMs <= 100  ? 95
    : runtimeMs <= 500  ? 82
    : runtimeMs <= 2000 ? 60
    : Math.max(20, Math.round(100 - runtimeMs / 50))

  // Error mitigation 0–100
  const emScore = emLevel === "high" ? 90 : emLevel === "medium" ? 60 : emLevel === "low" ? 30 : 0

  // Measurement probabilities
  const measurementData = results?.counts
    ? Object.entries(results.counts as Record<string, number>)
        .map(([bitstring, count]) => ({ bitstring, probability: count / (totalShots || 1) }))
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 10)
    : []

  return (
    <Card className="p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <h2 className="text-2xl font-bold text-foreground">Execution Dashboard</h2>
          <ChevronDown size={24} className={`text-primary transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
        </div>
        {onDownload && results && (
          <Button onClick={onDownload} size="sm" variant="outline" className="flex items-center gap-2 bg-transparent">
            <Download size={16} /> Download
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="space-y-6">

          {/* ── Gauges row ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 place-items-center">
            {/* 1. Reliability speedometer */}
            <MetricGauge
              value={reliabilityScore}
              label="Reliability"
              unit="%"
              size="md"
            />

            {/* 2. Qubits used — just a number card, no gauge needed */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex flex-col items-center justify-center w-28 h-28 rounded-full border-4 bg-secondary/50" style={{ borderColor: "#7ab5ac50" }}>
                <span className="text-3xl font-bold" style={{ color: "#7ab5ac" }}>{qubitsUsed}</span>
                <span className="text-[10px] text-muted-foreground">/ 30</span>
              </div>
              <p className="text-xs text-muted-foreground font-medium">Qubits Used</p>
            </div>

            {/* 3. Performance speedometer */}
            <MetricGauge
              value={perfScore}
              label="Performance"
              subtitle={`${runtimeMs}ms`}
              size="md"
            />

            {/* 4. Fidelity speedometer */}
            <MetricGauge
              value={fidelity}
              label="Fidelity"
              unit="%"
              size="md"
            />
          </div>

          {/* ── Error mitigation linear bar ──────────────────── */}
          <div className="px-2">
            <LinearMetric
              value={emScore}
              label="Error Mitigation"
              displayValue={emLevel}
              levels={["None", "Low", "Med", "High"]}
            />
          </div>

          {/* ── Quick stat cards ─────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Success Rate", value: `${successRate}%`,  flash: srFlash      },
              { label: "Total Shots",  value: `${totalShots}`,    flash: shotsFlash   },
              { label: "Backend",      value: results ? (backendNames[backend] ?? backend) : "—", flash: "" },
              { label: "Runtime",      value: `${runtimeMs}ms`,  flash: runtimeFlash  },
            ].map(({ label, value, flash }) => (
              <div key={label} className={`p-3 bg-secondary/50 rounded-lg border border-border text-center ${flash}`}>
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
              </div>
            ))}
          </div>

          {/* ── Technical Details (collapsible) ─────────────── */}
          <div>
            <Button
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              variant="outline"
              size="sm"
              className="w-full flex items-center justify-between bg-secondary/30 hover:bg-secondary/50 border-border"
            >
              <div className="flex items-center gap-2">
                <Info size={15} className="text-muted-foreground" />
                <span className="text-sm font-medium">Technical Details</span>
              </div>
              <ChevronDown size={16} className={`text-muted-foreground transition-transform duration-300 ${showTechnicalDetails ? "rotate-180" : ""}`} />
            </Button>

            {showTechnicalDetails && (
              <div className="mt-3 space-y-3 pl-2 border-l-2 border-border">
                <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                  <p className="text-xs font-semibold text-foreground mb-1">Backend</p>
                  <p className="text-xs text-muted-foreground">{backendNames[backend] ?? backend}</p>
                  {results?.backendReason && <p className="text-xs text-muted-foreground mt-1">{results.backendReason}</p>}
                </div>

                {results?.error_mitigation_requested === "auto" && (
                  <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                    <p className="text-xs font-semibold text-foreground mb-1">ML Auto-Tuning</p>
                    <p className="text-xs text-muted-foreground">
                      Mitigation: <span className="font-medium capitalize" style={{ color: "#7ab5ac" }}>{emLevel}</span>
                      <span className="text-muted-foreground ml-1">(RL-resolved)</span>
                    </p>
                    {results.ml_tuning && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {results.ml_tuning.reasoning} — {Math.round((results.ml_tuning.confidence ?? 0) * 100)}% confidence
                        {results.ml_tuning.based_on_executions > 0 && ` · ${results.ml_tuning.based_on_executions} prior runs`}
                      </p>
                    )}
                  </div>
                )}

                <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                  <p className="text-xs font-semibold text-foreground mb-2">Execution Details</p>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    {[
                      ["Runtime",  `${runtimeMs}ms`      ],
                      ["Qubits",   `${qubitsUsed}`        ],
                      ["Shots",    `${totalShots}`        ],
                      ["Success",  `${successRate}%`      ],
                      ["Fidelity", `${fidelity}%`         ],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <span className="text-muted-foreground">{k}: </span>
                        <span className="font-mono text-foreground">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Digital Twin Insights (collapsible) ─────────── */}
          {hasDT && (
            <div>
              <Button
                onClick={() => setShowDigitalTwinDetails(!showDigitalTwinDetails)}
                variant="outline"
                size="sm"
                className="w-full flex items-center justify-between bg-secondary/30 hover:bg-secondary/50 border-border"
              >
                <div className="flex items-center gap-2">
                  <Brain size={15} className="text-primary" />
                  <span className="text-sm font-medium">Digital Twin Insights</span>
                </div>
                <ChevronDown size={16} className={`text-muted-foreground transition-transform duration-300 ${showDigitalTwinDetails ? "rotate-180" : ""}`} />
              </Button>

              {showDigitalTwinDetails && (
                <div className="mt-3 space-y-3 pl-2 border-l-2 border-border">
                  {(digitalTwin.interpretation || digitalTwin.insights?.interpretation) && (
                    <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                      <div className="flex items-center gap-2 mb-1">
                        <Lightbulb size={14} className="text-primary" />
                        <p className="text-xs font-semibold text-foreground">Interpretation</p>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {digitalTwin.interpretation || digitalTwin.insights?.interpretation}
                      </p>
                    </div>
                  )}

                  {((digitalTwin.behavior_insights?.length > 0) || (digitalTwin.insights?.key_findings?.length > 0)) && (
                    <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp size={14} className="text-primary" />
                        <p className="text-xs font-semibold text-foreground">Key Findings</p>
                      </div>
                      <ul className="space-y-1">
                        {(digitalTwin.behavior_insights || digitalTwin.insights?.key_findings || []).map((f: string, i: number) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <span className="text-primary mt-0.5">•</span><span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {digitalTwin.performance_metrics && (
                    <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                      <p className="text-xs font-semibold text-foreground mb-2">Performance Metrics</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "Speed",       value: digitalTwin.performance_metrics.executionSpeed },
                          { label: "Convergence", value: digitalTwin.performance_metrics.convergence    },
                          { label: "Reliability", value: digitalTwin.performance_metrics.reliability    },
                        ].map((m) => (
                          <div key={m.label} className="text-center p-2 bg-secondary/50 rounded">
                            <div className="text-[10px] text-muted-foreground">{m.label}</div>
                            <div className="text-xs font-bold capitalize" style={{ color: "#7ab5ac" }}>{m.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {digitalTwin.statistical_analysis && (
                    <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                      <p className="text-xs font-semibold text-foreground mb-2">Statistical Analysis</p>
                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        <div><span className="text-muted-foreground">Entropy: </span><span className="font-mono">{digitalTwin.statistical_analysis.entropy?.toFixed(2)} bits</span></div>
                        <div><span className="text-muted-foreground">Convergence: </span><span className="font-mono capitalize">{digitalTwin.statistical_analysis.convergence}</span></div>
                        <div><span className="text-muted-foreground">Unique States: </span><span className="font-mono">{digitalTwin.statistical_analysis.unique_outcomes}</span></div>
                        <div><span className="text-muted-foreground">Std Dev: </span><span className="font-mono">{digitalTwin.statistical_analysis.std_probability?.toFixed(4)}</span></div>
                      </div>
                    </div>
                  )}

                  {((digitalTwin.system_recommendations?.length > 0) || (digitalTwin.insights?.recommendations?.length > 0)) && (
                    <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                      <p className="text-xs font-semibold text-foreground mb-1">Recommendations</p>
                      <ul className="space-y-1">
                        {(digitalTwin.system_recommendations || digitalTwin.insights?.recommendations || []).map((r: string, i: number) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <span className="text-primary mt-0.5">→</span><span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Measurement Probabilities ─────────────────────── */}
          <div>
            <p className="text-sm font-medium text-foreground mb-3">Measurement Probabilities</p>
            <div className="space-y-1.5 max-h-80 overflow-auto">
              {measurementData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-secondary/30 rounded border border-border hover:bg-secondary/50 transition-colors">
                  <code className="text-xs font-mono text-foreground">{item.bitstring}</code>
                  <div className="flex items-center gap-2">
                    <div className="w-24 sm:w-32 bg-secondary rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{ width: `${item.probability * 100}%`, backgroundColor: "#7ab5ac" }}
                      />
                    </div>
                    <span className="text-xs font-medium w-10 text-right" style={{ color: "#7ab5ac" }}>
                      {Math.round(item.probability * 100)}%
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
