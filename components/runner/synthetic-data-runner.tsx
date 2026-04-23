"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, Square, Settings2, FlaskConical, ChevronDown, ChevronUp } from "lucide-react"
import {
  useSyntheticMode,
  qubitsFromInputs,
  type SyntheticParams,
} from "@/contexts/synthetic-mode-context"

const ALGORITHMS = ["Grover", "VQE", "QAOA", "QFT", "Shor", "Bell", "Deutsch-Jozsa"]

export function SyntheticDataRunner() {
  const { isRunning, params, setParams, iteration, lastRow, error, start, stop } =
    useSyntheticMode()
  const [showParams, setShowParams] = useState(false)

  const setParam = <K extends keyof SyntheticParams>(key: K, value: SyntheticParams[K]) =>
    setParams({ ...params, [key]: value })

  const minQubits = qubitsFromInputs(params.minInputs)
  const maxQubits = qubitsFromInputs(params.maxInputs)

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
              onClick={stop}
              className="flex items-center gap-1 h-7 px-3 text-xs"
            >
              <Square size={11} fill="currentColor" />
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={start}
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
        Generates synthetic telemetry and runs it through the Planck quantum pipeline automatically — no SDK or
        scripting needed. Keeps executing{" "}
        <strong className="text-foreground">even if you navigate to another page</strong>.
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
                title="Interval between executions in seconds"
                value={params.intervalSecs}
                onChange={(e) => setParam("intervalSecs", Math.max(0.5, Number(e.target.value)))}
                className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#7ab5ac]"
              />
            </div>

            {/* Algorithm */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Algorithm</label>
              <select
                title="Quantum algorithm"
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

            {/* Data inputs range — qubits auto-derived from this */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Data inputs range
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={1_000_000}
                  title="Min data inputs"
                  value={params.minInputs}
                  onChange={(e) => setParam("minInputs", Math.min(Number(e.target.value), params.maxInputs))}
                  className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#7ab5ac]"
                />
                <span className="text-muted-foreground text-[10px] flex-shrink-0">–</span>
                <input
                  type="number"
                  min={1}
                  max={1_000_000}
                  title="Max data inputs"
                  value={params.maxInputs}
                  onChange={(e) => setParam("maxInputs", Math.max(Number(e.target.value), params.minInputs))}
                  className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#7ab5ac]"
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                → auto qubits{" "}
                <span className="font-semibold text-[#7ab5ac]">
                  {minQubits === maxQubits ? minQubits : `${minQubits}–${maxQubits}`}
                </span>{" "}
                · gates scale with qubits
              </p>
            </div>

            {/* Sensor temperature range */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Sensor temp <span className="text-[10px]">(°C)</span>
              </label>
              <div className="flex items-center gap-1">
                <input type="number" title="Min temp" value={params.minTemp}
                  onChange={(e) => setParam("minTemp", Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#7ab5ac]" />
                <span className="text-muted-foreground text-[10px] flex-shrink-0">–</span>
                <input type="number" title="Max temp" value={params.maxTemp}
                  onChange={(e) => setParam("maxTemp", Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#7ab5ac]" />
              </div>
            </div>

            {/* Sensor voltage range */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Sensor voltage <span className="text-[10px]">(V)</span>
              </label>
              <div className="flex items-center gap-1">
                <input type="number" step={0.01} title="Min voltage" value={params.minVoltage}
                  onChange={(e) => setParam("minVoltage", Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#7ab5ac]" />
                <span className="text-muted-foreground text-[10px] flex-shrink-0">–</span>
                <input type="number" step={0.01} title="Max voltage" value={params.maxVoltage}
                  onChange={(e) => setParam("maxVoltage", Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#7ab5ac]" />
              </div>
            </div>

            {/* Noise range */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Sensor noise <span className="text-[10px]">(σ)</span>
              </label>
              <div className="flex items-center gap-1">
                <input type="number" step={0.001} min={0} max={1} title="Min noise" value={params.minNoise}
                  onChange={(e) => setParam("minNoise", Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#7ab5ac]" />
                <span className="text-muted-foreground text-[10px] flex-shrink-0">–</span>
                <input type="number" step={0.001} min={0} max={1} title="Max noise" value={params.maxNoise}
                  onChange={(e) => setParam("maxNoise", Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#7ab5ac]" />
              </div>
            </div>
          </div>

          {/* Config summary */}
          <div className="pt-2 border-t border-border text-[10px] text-muted-foreground">
            <p>
              Every <strong className="text-foreground">{params.intervalSecs}s</strong>: run{" "}
              <strong className="text-foreground">{params.algorithm}</strong> with{" "}
              <strong className="text-foreground">{params.minInputs}–{params.maxInputs}</strong>{" "}
              random inputs →{" "}
              <strong className="text-[#7ab5ac]">
                {minQubits === maxQubits ? minQubits : `${minQubits}–${maxQubits}`} qubits
              </strong>{" "}
              auto-derived.
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
            Press <strong>Start</strong> to begin generating synthetic quantum executions.<br />
            <span className="text-xs">Keeps running across all pages until you press <strong>Stop</strong>.</span>
          </p>
        </div>
      )}
    </Card>
  )
}
