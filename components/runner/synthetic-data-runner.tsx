"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, Square, Settings2, FlaskConical, ChevronDown, ChevronUp } from "lucide-react"
import { broadcastExecution } from "@/hooks/use-live-mode"
import type { ExecutionRow } from "@/hooks/use-live-executions"

// ─── Parameter types ──────────────────────────────────────────────────────────

interface SyntheticParams {
  intervalSecs: number
  minQubits: number
  maxQubits: number
  minInputs: number
  maxInputs: number
  algorithm: string
  minTemp: number
  maxTemp: number
  minVoltage: number
  maxVoltage: number
  minNoise: number
  maxNoise: number
}

const ALGORITHMS = ["Grover", "VQE", "QAOA", "QFT", "Shor", "Bell", "Deutsch-Jozsa"]

const DEFAULT_PARAMS: SyntheticParams = {
  intervalSecs: 2,
  minQubits: 2,
  maxQubits: 8,
  minInputs: 1,
  maxInputs: 100,
  algorithm: "Grover",
  minTemp: 20,
  maxTemp: 80,
  minVoltage: 0.9,
  maxVoltage: 1.2,
  minNoise: 0.0,
  maxNoise: 0.05,
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SyntheticDataRunnerProps {
  onNewRow: (row: ExecutionRow) => void
  selectedDigitalTwinId?: string | null
}

export function SyntheticDataRunner({ onNewRow, selectedDigitalTwinId }: SyntheticDataRunnerProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [params, setParams] = useState<SyntheticParams>(DEFAULT_PARAMS)
  const [iteration, setIteration] = useState(0)
  const [lastRow, setLastRow] = useState<ExecutionRow | null>(null)
  const [showParams, setShowParams] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const iterRef = useRef(0)
  const paramsRef = useRef(params)
  const selectedTwinRef = useRef(selectedDigitalTwinId)

  // Keep refs in sync so the interval callback always sees fresh values
  useEffect(() => { paramsRef.current = params }, [params])
  useEffect(() => { selectedTwinRef.current = selectedDigitalTwinId }, [selectedDigitalTwinId])

  // ── Core synthetic execution ──────────────────────────────────────────────

  const runIteration = useCallback(async () => {
    const p = paramsRef.current

    // Random synthetic telemetry (mirrors the Python script)
    const qubits = Math.floor(p.minQubits + Math.random() * (p.maxQubits - p.minQubits + 1))
    const nInputs = Math.floor(p.minInputs + Math.random() * (p.maxInputs - p.minInputs + 1))
    const data = Array.from({ length: nInputs }, () => Math.random() * 10_000)

    const iterIndex = iterRef.current

    try {
      // 1. Generate a circuit from the synthetic data
      const genRes = await fetch("/api/quantum/generate-circuit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          algorithm: p.algorithm,
          inputData: data,
          qubits,
          shots: 1024,
          errorMitigation: "auto",
          dataMetadata: { structure: "array", dimensions: 1, size: nInputs },
        }),
      })
      const genData = genRes.ok ? await genRes.json() : null

      // 2. Simulate the circuit
      const simRes = await fetch("/api/quantum/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qasm:
            genData?.success && genData?.qasm
              ? genData.qasm
              : `OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[${qubits}];\ncreg c[${qubits}];`,
          shots: 1024,
          backend: "auto",
          errorMitigation: "auto",
          circuitName: `Synthetic-${p.algorithm}-${iterIndex}`,
          algorithm: p.algorithm,
          executionType: "auto",
          qubits,
          inputData: data,
        }),
      })
      const simData = simRes.ok ? await simRes.json() : null

      if (!simData?.success) {
        // Non-fatal — report but keep looping
        setError(simData?.error ?? "Simulation returned no result")
        return
      }

      setError(null)

      const row: ExecutionRow = {
        id: `synth-${Date.now()}-${iterIndex}`,
        created_at: new Date().toISOString(),
        circuit_name: `Synthetic-${p.algorithm}-${iterIndex}`,
        algorithm: p.algorithm,
        status: "completed",
        shots: 1024,
        qubits_used: simData.qubits ?? qubits,
        runtime_ms: simData.runtime ?? 0,
        success_rate: simData.successRate ?? 0,
        backend_selected: simData.backend ?? "quantum_inspired_gpu",
        error_mitigation: simData.error_mitigation ?? "auto",
        digital_twin_id: selectedTwinRef.current ?? null,
        circuit_data: {
          source: "synthetic",
          fidelity: simData.fidelity ?? 95,
          counts: simData.counts ?? {},
          qasm: genData?.qasm ?? null,
          ml_tuning: simData.ml_tuning ?? null,
          backend_reason: simData.backendReason ?? null,
        },
      }

      setLastRow(row)
      onNewRow(row)
      broadcastExecution(row)

      // Persist to localStorage cache (same cache used by dashboard)
      try {
        const raw = localStorage.getItem("planck_exec_cache")
        const existing: ExecutionRow[] = raw ? JSON.parse(raw) : []
        const updated = [row, ...existing.filter((r) => r.id !== row.id)].slice(0, 500)
        localStorage.setItem("planck_exec_cache", JSON.stringify(updated))
      } catch {
        // localStorage unavailable — fail silently
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error")
    }

    iterRef.current += 1
    setIteration(iterRef.current)
  }, [onNewRow])

  // ── Start / stop ─────────────────────────────────────────────────────────

  const startLoop = useCallback(() => {
    iterRef.current = 0
    setIteration(0)
    setIsRunning(true)
    runIteration() // immediate first tick
    intervalRef.current = setInterval(runIteration, paramsRef.current.intervalSecs * 1_000)
  }, [runIteration])

  const stopLoop = useCallback(() => {
    setIsRunning(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Restart interval when interval duration changes while running
  useEffect(() => {
    if (!isRunning) return
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(runIteration, params.intervalSecs * 1_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isRunning, params.intervalSecs, runIteration])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  // ── Helpers ──────────────────────────────────────────────────────────────

  const setParam = <K extends keyof SyntheticParams>(key: K, value: SyntheticParams[K]) =>
    setParams((prev) => ({ ...prev, [key]: value }))

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Card className="p-5 border border-[#7ab5ac]/30 bg-[#7ab5ac]/5 shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FlaskConical size={16} className="text-[#7ab5ac]" />
          <h3 className="text-sm font-semibold text-foreground">Synthetic Data Runner</h3>
          {isRunning && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7ab5ac] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#7ab5ac]" />
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="text-xs text-muted-foreground tabular-nums">{iteration} iter{iteration !== 1 ? "s" : ""}</span>
          )}
          <button
            onClick={() => setShowParams((v) => !v)}
            className={`p-1.5 rounded-md border transition-colors ${
              showParams
                ? "border-[#7ab5ac]/60 bg-[#7ab5ac]/10 text-[#7ab5ac]"
                : "border-border text-muted-foreground hover:border-[#7ab5ac]/40"
            }`}
            aria-label="Toggle parameters"
          >
            <Settings2 size={13} />
          </button>
          {showParams ? (
            <ChevronUp size={13} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={13} className="text-muted-foreground" />
          )}

          {isRunning ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={stopLoop}
              className="flex items-center gap-1 h-7 px-3 text-xs"
            >
              <Square size={11} fill="currentColor" />
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={startLoop}
              className="flex items-center gap-1 h-7 px-3 text-xs"
              style={{ backgroundColor: "#7ab5ac" }}
            >
              <Play size={11} fill="currentColor" />
              Start
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Generates synthetic telemetry locally and runs it through the Planck quantum pipeline automatically — no SDK
        or remote scripting required.
      </p>

      {/* Error */}
      {error && (
        <div className="mb-3 px-3 py-2 rounded-md border border-destructive/40 bg-destructive/10 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Parameter panel */}
      {showParams && (
        <div className="mb-4 p-4 border border-border rounded-lg bg-background/60 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Execution Parameters
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
            {/* Interval */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Interval <span className="text-[10px]">(sec)</span>
              </label>
              <input
                type="number"
                min={0.5}
                max={300}
                step={0.5}
                value={params.intervalSecs}
                disabled={isRunning}
                onChange={(e) => setParam("intervalSecs", Math.max(0.5, Number(e.target.value)))}
                className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#7ab5ac] disabled:opacity-50"
              />
            </div>

            {/* Algorithm */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Algorithm</label>
              <select
                value={params.algorithm}
                onChange={(e) => setParam("algorithm", e.target.value)}
                className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#7ab5ac]"
              >
                {ALGORITHMS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            {/* Qubits range */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Qubits range
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={params.minQubits}
                  onChange={(e) => setParam("minQubits", Math.min(Number(e.target.value), params.maxQubits))}
                  className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#7ab5ac]"
                />
                <span className="text-muted-foreground text-[10px] flex-shrink-0">–</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={params.maxQubits}
                  onChange={(e) => setParam("maxQubits", Math.max(Number(e.target.value), params.minQubits))}
                  className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#7ab5ac]"
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">→ logic gates vary with qubits</p>
            </div>

            {/* Data points range */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Data inputs range
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={10_000}
                  value={params.minInputs}
                  onChange={(e) => setParam("minInputs", Math.min(Number(e.target.value), params.maxInputs))}
                  className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#7ab5ac]"
                />
                <span className="text-muted-foreground text-[10px] flex-shrink-0">–</span>
                <input
                  type="number"
                  min={1}
                  max={10_000}
                  value={params.maxInputs}
                  onChange={(e) => setParam("maxInputs", Math.max(Number(e.target.value), params.minInputs))}
                  className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#7ab5ac]"
                />
              </div>
            </div>

            {/* Sensor temperature range */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Sensor temp <span className="text-[10px]">(°C)</span>
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={params.minTemp}
                  onChange={(e) => setParam("minTemp", Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#7ab5ac]"
                />
                <span className="text-muted-foreground text-[10px] flex-shrink-0">–</span>
                <input
                  type="number"
                  value={params.maxTemp}
                  onChange={(e) => setParam("maxTemp", Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#7ab5ac]"
                />
              </div>
            </div>

            {/* Sensor voltage range */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Sensor voltage <span className="text-[10px]">(V)</span>
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step={0.01}
                  value={params.minVoltage}
                  onChange={(e) => setParam("minVoltage", Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#7ab5ac]"
                />
                <span className="text-muted-foreground text-[10px] flex-shrink-0">–</span>
                <input
                  type="number"
                  step={0.01}
                  value={params.maxVoltage}
                  onChange={(e) => setParam("maxVoltage", Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#7ab5ac]"
                />
              </div>
            </div>

            {/* Noise range */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Sensor noise <span className="text-[10px]">(σ)</span>
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step={0.001}
                  min={0}
                  max={1}
                  value={params.minNoise}
                  onChange={(e) => setParam("minNoise", Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#7ab5ac]"
                />
                <span className="text-muted-foreground text-[10px] flex-shrink-0">–</span>
                <input
                  type="number"
                  step={0.001}
                  min={0}
                  max={1}
                  value={params.maxNoise}
                  onChange={(e) => setParam("maxNoise", Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#7ab5ac]"
                />
              </div>
            </div>
          </div>

          {/* Current config summary */}
          <div className="pt-2 border-t border-border text-[10px] text-muted-foreground space-y-0.5">
            <p>
              Every <strong className="text-foreground">{params.intervalSecs}s</strong>: run{" "}
              <strong className="text-foreground">{params.algorithm}</strong> with{" "}
              <strong className="text-foreground">
                {params.minQubits}–{params.maxQubits}
              </strong>{" "}
              qubits and{" "}
              <strong className="text-foreground">
                {params.minInputs}–{params.maxInputs}
              </strong>{" "}
              random data points.
            </p>
          </div>
        </div>
      )}

      {/* Live status — last execution row */}
      {lastRow ? (
        <div
          className={`flex items-center justify-between px-3 py-2 rounded-md border text-xs transition-colors ${
            isRunning
              ? "border-[#7ab5ac]/40 bg-[#7ab5ac]/10"
              : "border-border bg-secondary/30"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${
                isRunning ? "bg-[#7ab5ac] animate-pulse" : "bg-muted-foreground"
              }`}
            />
            <span className="font-medium text-foreground truncate">{lastRow.circuit_name}</span>
            <span className="text-muted-foreground hidden sm:inline">{lastRow.algorithm}</span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 text-muted-foreground">
            <span>{lastRow.qubits_used}q</span>
            <span>{lastRow.runtime_ms}ms</span>
            <span className="font-medium" style={{ color: "#7ab5ac" }}>
              {lastRow.success_rate?.toFixed(1)}%
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center py-6 rounded-lg border border-dashed border-border bg-secondary/30">
          <p className="text-sm text-muted-foreground text-center px-4">
            Press <strong>Start</strong> to begin generating synthetic quantum executions locally.
          </p>
        </div>
      )}
    </Card>
  )
}
