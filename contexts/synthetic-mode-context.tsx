"use client"

/**
 * contexts/synthetic-mode-context.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Global context for the Synthetic Data Runner.
 *
 * Lifting the execution loop here (rather than keeping it inside the runner
 * page component) means it keeps running across page navigation — the context
 * lives in the QSaaS layout and never unmounts.
 *
 * State is persisted in localStorage so the running/stopped state survives a
 * hard refresh. A BroadcastChannel ("planck_synthetic") syncs toggles across
 * multiple tabs.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react"
import { broadcastExecution } from "@/hooks/use-live-mode"
import type { ExecutionRow } from "@/hooks/use-live-executions"

// ─── Public types ─────────────────────────────────────────────────────────────

export interface SyntheticParams {
  intervalSecs: number
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

export interface SyntheticModeContextType {
  isRunning: boolean
  params: SyntheticParams
  setParams: (p: SyntheticParams) => void
  iteration: number
  lastRow: ExecutionRow | null
  error: string | null
  start: () => void
  stop: () => void
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_SYNTHETIC_PARAMS: SyntheticParams = {
  intervalSecs: 2,
  minInputs: 1,
  maxInputs: 1000,
  algorithm: "Grover",
  minTemp: 20,
  maxTemp: 80,
  minVoltage: 0.9,
  maxVoltage: 1.2,
  minNoise: 0.0,
  maxNoise: 0.05,
}

/**
 * Derive qubit count automatically from number of data inputs.
 * Mirrors circuit-builder's analyzeInputData() for flat scalar arrays
 * (featureCount=1 → base=2), with qBonus scaling logarithmically with sample count.
 * This keeps qubit counts sensible: ~4 for ≤100 inputs, ~5 for ≤1 000, ~6 for ≤100 000.
 */
export function qubitsFromInputs(nInputs: number): number {
  const qBonus = Math.floor(Math.log2(Math.log2(nInputs + 1) + 1))
  return Math.max(2, Math.min(20, 2 + qBonus))
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SYNTHETIC_CHANNEL = "planck_synthetic"
const LS_RUNNING_KEY = "planck_synthetic_running"
const LS_PARAMS_KEY = "planck_synthetic_params"

// ─── Context ─────────────────────────────────────────────────────────────────

const SyntheticModeContext = createContext<SyntheticModeContextType>({
  isRunning: false,
  params: DEFAULT_SYNTHETIC_PARAMS,
  setParams: () => {},
  iteration: 0,
  lastRow: null,
  error: null,
  start: () => {},
  stop: () => {},
})

export function SyntheticModeProvider({
  children,
  selectedDigitalTwinId,
}: {
  children: ReactNode
  selectedDigitalTwinId?: string | null
}) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [isRunning, setIsRunning] = useState(false)
  const [params, _setParams] = useState<SyntheticParams>(DEFAULT_SYNTHETIC_PARAMS)
  const [iteration, setIteration] = useState(0)
  const [lastRow, setLastRow] = useState<ExecutionRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Refs keep the interval callback always reading the latest values
  const paramsRef = useRef(params)
  const isRunningRef = useRef(false)
  const iterRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const selectedTwinRef = useRef(selectedDigitalTwinId)

  useEffect(() => { paramsRef.current = params }, [params])
  useEffect(() => { selectedTwinRef.current = selectedDigitalTwinId }, [selectedDigitalTwinId])

  // ── Hydrate from localStorage on mount ───────────────────────────────────
  useEffect(() => {
    try {
      const savedParams = localStorage.getItem(LS_PARAMS_KEY)
      if (savedParams) _setParams(JSON.parse(savedParams))
      const wasRunning = localStorage.getItem(LS_RUNNING_KEY) === "1"
      if (wasRunning) {
        // Auto-resume after page refresh
        startLoop()
      }
    } catch {
      // localStorage unavailable
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Cross-tab BroadcastChannel ────────────────────────────────────────────
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return
    const ch = new BroadcastChannel(SYNTHETIC_CHANNEL)
    const handler = (event: MessageEvent) => {
      const { type, params: p, running } = event.data ?? {}
      if (type === "synthetic_params_changed" && p) {
        _setParams(p)
      }
      if (type === "synthetic_running_changed") {
        if (running && !isRunningRef.current) startLoop()
        if (!running && isRunningRef.current) stopLoop()
      }
    }
    ch.addEventListener("message", handler)
    return () => { ch.removeEventListener("message", handler); ch.close() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Core tick ─────────────────────────────────────────────────────────────
  const runIteration = useCallback(async () => {
    const p = paramsRef.current

    const nInputs = Math.floor(
      p.minInputs + Math.random() * (p.maxInputs - p.minInputs + 1),
    )
    const qubits = qubitsFromInputs(nInputs)
    const data = Array.from({ length: nInputs }, () => Math.random() * 10_000)

    const iterIndex = iterRef.current

    try {
      // 1. Generate circuit from synthetic data
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

      // Use the data-aware recommended shot count from circuit generation;
      // fall back to 1024 only if the API didn't return one.
      const recommendedShots: number = genData?.recommendedShots ?? 1024

      // 2. Simulate
      const simRes = await fetch("/api/quantum/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qasm:
            genData?.success && genData?.qasm
              ? genData.qasm
              : `OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[${qubits}];\ncreg c[${qubits}];`,
          shots: recommendedShots,
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
        shots: simData.total_shots ?? recommendedShots,
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
      broadcastExecution(row)

      // Persist to localStorage cache
      try {
        const raw = localStorage.getItem("planck_exec_cache")
        const existing: ExecutionRow[] = raw ? JSON.parse(raw) : []
        const updated = [row, ...existing.filter((r) => r.id !== row.id)].slice(0, 500)
        localStorage.setItem("planck_exec_cache", JSON.stringify(updated))
      } catch {
        // fail silently
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error")
    }

    iterRef.current += 1
    setIteration(iterRef.current)
  }, [])

  // ── Start / stop helpers ──────────────────────────────────────────────────
  const startLoop = useCallback(() => {
    if (isRunningRef.current) return
    isRunningRef.current = true
    iterRef.current = 0
    setIteration(0)
    setIsRunning(true)

    try { localStorage.setItem(LS_RUNNING_KEY, "1") } catch { /**/ }

    runIteration() // immediate first tick
    intervalRef.current = setInterval(
      () => runIteration(),
      paramsRef.current.intervalSecs * 1_000,
    )
  }, [runIteration])

  const stopLoop = useCallback(() => {
    isRunningRef.current = false
    setIsRunning(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    try { localStorage.setItem(LS_RUNNING_KEY, "0") } catch { /**/ }
  }, [])

  // Restart interval when interval duration changes while running
  useEffect(() => {
    if (!isRunning) return
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => runIteration(), params.intervalSecs * 1_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isRunning, params.intervalSecs, runIteration])

  // Cleanup on unmount (shouldn't happen since this lives in the layout)
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  // ── Persist params to localStorage ───────────────────────────────────────
  const setParams = useCallback((p: SyntheticParams) => {
    _setParams(p)
    try { localStorage.setItem(LS_PARAMS_KEY, JSON.stringify(p)) } catch { /**/ }
    // Broadcast to other tabs
    try {
      const ch = new BroadcastChannel(SYNTHETIC_CHANNEL)
      ch.postMessage({ type: "synthetic_params_changed", params: p })
      ch.close()
    } catch { /**/ }
  }, [])

  const start = useCallback(() => {
    startLoop()
    try {
      const ch = new BroadcastChannel(SYNTHETIC_CHANNEL)
      ch.postMessage({ type: "synthetic_running_changed", running: true })
      ch.close()
    } catch { /**/ }
  }, [startLoop])

  const stop = useCallback(() => {
    stopLoop()
    try {
      const ch = new BroadcastChannel(SYNTHETIC_CHANNEL)
      ch.postMessage({ type: "synthetic_running_changed", running: false })
      ch.close()
    } catch { /**/ }
  }, [stopLoop])

  return (
    <SyntheticModeContext.Provider
      value={{ isRunning, params, setParams, iteration, lastRow, error, start, stop }}
    >
      {children}
    </SyntheticModeContext.Provider>
  )
}

export function useSyntheticMode() {
  return useContext(SyntheticModeContext)
}
