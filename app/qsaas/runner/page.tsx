"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CircuitSettings } from "@/components/runner/circuit-settings"
import { ExecutionSettings } from "@/components/runner/execution-settings"
import { DatabaseUploader } from "@/components/runner/database-uploader"
import { AutoParser } from "@/components/runner/autoparser"
import { ExpectedResults } from "@/components/runner/expected-results"
import { CircuitResults } from "@/components/runner/circuit-results"
import { SyntheticDataRunner } from "@/components/runner/synthetic-data-runner"
import { useSyntheticMode } from "@/contexts/synthetic-mode-context"
import { Save, Play, RotateCcw, Download, Loader2, Radio, Wifi, WifiOff, Trash2, Brain, FlaskConical, ChevronDown, Settings2, Target, Layers, AlertTriangle, TrendingUp, Zap, Shield, BarChart3 } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import type { BuiltCircuit } from "@/lib/circuit-builder"

// CircuitData extends BuiltCircuit with a gates array for backwards-compat
// (BuiltCircuit stores only gateCount; CircuitData keeps the full gate list)
interface CircuitData {
  qubits: number
  depth: number
  gates: string[]
  qasm?: string
  gateCount?: number
  algorithm?: string
  paramSummary?: string
}
import { selectOptimalBackend, calculateFidelity, estimateRuntime } from "@/lib/backend-selector"
import { DigitalTwinPanel } from "@/components/runner/digital-twin-panel"
import { DigitalTwinSelector } from "@/components/runner/digital-twin-selector"
import { DigitalTwinDashboard } from "@/components/dashboard/digital-twin-dashboard"
import { useLiveExecutions, type ExecutionRow } from "@/hooks/use-live-executions"
import { useLiveMode, broadcastExecution } from "@/hooks/use-live-mode"
import { useIsGuest } from "@/components/guest-banner"
import { useUIPreferences } from "@/contexts/ui-preferences-context"
import { useDigitalTwinMode } from "@/contexts/digital-twin-mode-context"

/** Convert a manual-run results object into the ExecutionRow shape the DT dashboard expects. */
function resultToRow(
  r: any,
  ctx: { circuitName: string; shots: number | null; qubits: number; backend: string; errorMitigation: string; digitalTwinId?: string | null; qasm?: string | null },
) {
  return {
    id: r._liveJobId ?? "manual-run",
    created_at: new Date().toISOString(),
    circuit_name: r.circuit_name ?? ctx.circuitName,
    algorithm: r.algorithm ?? ctx.circuitName,
    status: "completed" as const,
    shots: r.total_shots ?? ctx.shots ?? 1024,
    qubits_used: r.qubits_used ?? ctx.qubits,
    runtime_ms: r.runtime_ms ?? 0,
    success_rate: r.success_rate ?? 0,
    backend_selected: r.backend_selected ?? ctx.backend,
    error_mitigation: r.error_mitigation ?? ctx.errorMitigation,
    digital_twin_id: ctx.digitalTwinId ?? null,
    circuit_data: {
      fidelity: r.fidelity,
      counts: r.counts,
      qasm: ctx.qasm ?? null,
      ml_tuning: r.ml_tuning ?? null,
      backend_reason: r.backendReason ?? null,
    },
  }
}

/** Read planck_exec_cache from localStorage (same cache the dashboard uses). */
function readExecCache(): ExecutionRow[] {
  try {
    const raw = localStorage.getItem("planck_exec_cache")
    if (!raw) return []
    return JSON.parse(raw) as ExecutionRow[]
  } catch {
    return []
  }
}

export default function RunnerPage() {
  const [isRunning, setIsRunning] = useState(false)
  const [executionName, setExecutionName] = useState("")
  const [targetLatency, setTargetLatency] = useState<number | null>(null)
  const [circuitName, setCircuitName] = useState("")
  const [executionType, setExecutionType] = useState<"auto" | "manual">("auto")
  const [backend, setBackend] = useState<"quantum_inspired_gpu" | "hpc_gpu" | "quantum_qpu">("quantum_inspired_gpu")
  const [shots, setShots] = useState<number | null>(null)
  const [autoShots, setAutoShots] = useState<number | null>(null)
  const [qubits, setQubits] = useState(4)
  const [errorMitigation, setErrorMitigation] = useState<"auto" | "none" | "low" | "medium" | "high">("auto")
  const [results, setResults] = useState<any>(null)
  const [circuitCode, setCircuitCode] = useState("")
  const [circuitData, setCircuitData] = useState<CircuitData | null>(null)
  const [isCodeEditable, setIsCodeEditable] = useState(false)
  const [dataUploaded, setDataUploaded] = useState(false)
  const [uploadedData, setUploadedData] = useState<any>(null)
  const [circuitImageUrl, setCircuitImageUrl] = useState<string | null>(null)
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<string | null>(null)
  const [mlRecommendation, setMlRecommendation] = useState<{
    shots: number
    backend: string
    errorMitigation: string
    confidence: number
  } | null>(null)
  const [showVisualizer, setShowVisualizer] = useState(false)
  const [showCodeEditor, setShowCodeEditor] = useState(false)
  const [showDominantStates, setShowDominantStates] = useState(false)
  const [selectedDigitalTwinId, setSelectedDigitalTwinId] = useState<string | null>(null)
  const [showAdvancedQuantum, setShowAdvancedQuantum] = useState(false)

  // ── Scenario Setup state ─────────────────────────────────────────────────
  const [systemType, setSystemType] = useState<string>("Custom")
  const [scenarioName, setScenarioName] = useState<string>("")
  const [scenarioType, setScenarioType] = useState<"Baseline" | "Stress test" | "Optimization" | "Risk analysis" | "Custom">("Baseline")
  const [scenarioObjective, setScenarioObjective] = useState<"minimize_runtime" | "maximize_reliability" | "minimize_cost" | "maximize_accuracy" | "balanced">("balanced")
  const [riskTolerance, setRiskTolerance] = useState<"conservative" | "balanced" | "aggressive">("balanced")
  const [executionStrategy, setExecutionStrategy] = useState<"single" | "batch" | "compare">("single")
  const [batchSize, setBatchSize] = useState<1 | 3 | 5 | 10>(1)
  // Batch run state
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null)
  const [batchResults, setBatchResults] = useState<any[]>([])
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null)

  const isGuest = useIsGuest()
  const { isHidden } = useUIPreferences()
  const { dtMode } = useDigitalTwinMode()
  // Shared live mode — synced with dashboard via sessionStorage + BroadcastChannel
  const [sdkMode, setLiveEnabled] = useLiveMode(isGuest)
  const { isRunning: syntheticRunning, lastRow: synthLastRow } = useSyntheticMode()
  const [syntheticMode, setSyntheticMode] = useState(false)

  // ── Storage limit tracking (50 MB cap) ──────────────────────────────────
  const STORAGE_CAP_BYTES = 50 * 1024 * 1024
  const [storageUsedBytes, setStorageUsedBytes] = useState(0)

  /** Recompute storage from localStorage cache. Called on mount + after each run. */
  const refreshStorageEstimate = () => {
    try {
      const raw = localStorage.getItem("planck_exec_cache")
      if (!raw) { setStorageUsedBytes(0); return }
      const rows = JSON.parse(raw) as any[]
      const total = rows.reduce((s, r) => s + JSON.stringify(r).length, 0)
      setStorageUsedBytes(total)
    } catch { setStorageUsedBytes(0) }
  }

  useEffect(() => { refreshStorageEstimate() }, [])

  // ── SDK live: periodic polling fallback ────────────────────────────────────
  // SSE only sees rows written to the SAME Vercel lambda instance. SDK calls
  // often land on a different instance, so we poll /api/dashboard/data every
  // 3 s as a cross-instance fallback. New rows are fed into initialLiveRows
  // → useLiveExecutions merges them → liveRows updates → results + charts refresh.
  useEffect(() => {
    if (!sdkMode || isGuest) return
    const poll = async () => {
      try {
        const res = await fetch("/api/dashboard/data?timeRange=7d")
        if (!res.ok) return
        const data = await res.json()
        const serverRows: ExecutionRow[] = data.logs || []
        if (serverRows.length === 0) return
        setInitialLiveRows((prev) => {
          const prevIds = new Set(prev.map((r) => r.id))
          const fresh = serverRows.filter((r) => !prevIds.has(r.id))
          if (fresh.length === 0) return prev
          const merged = [...prev, ...fresh]
          merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          return merged.slice(-500)
        })
      } catch { /* non-fatal */ }
    }
    poll() // immediate on first enable
    const id = setInterval(poll, 3_000)
    return () => clearInterval(id)
  }, [sdkMode, isGuest])

  // ── Pre-seed live hook with cached + server data so SDK mode shows history ──
  const [initialLiveRows, setInitialLiveRows] = useState<ExecutionRow[]>([])
  const [clearKey, setClearKey] = useState(0)
  const [dtHistoryRows, setDtHistoryRows] = useState<ExecutionRow[]>([])

  // Load DTDashboard history from localStorage on mount (always, regardless of sdkMode)
  useEffect(() => {
    if (isGuest) return
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("runner_results_cleared") === "1") return
    const cached = readExecCache()
    if (cached.length > 0) {
      setDtHistoryRows(
        [...cached]
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .slice(-200),
      )
    }
  }, [isGuest])

  useEffect(() => {
    if (!sdkMode || isGuest) {
      setInitialLiveRows([])
      return
    }
    // 1. Immediately show localStorage cache
    const cached = readExecCache()
    if (cached.length > 0) {
      // Sort oldest→newest to match useLiveExecutions internal ordering
      const sorted = [...cached].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
      setInitialLiveRows(sorted)
    }
    // 2. Fetch from server to pick up any rows not in cache
    fetch("/api/dashboard/data?timeRange=30d")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.logs?.length) return
        const serverRows: ExecutionRow[] = data.logs
        setInitialLiveRows((prev) => {
          const ids = new Set(prev.map((r) => r.id))
          const fresh = serverRows.filter((r) => !ids.has(r.id))
          if (fresh.length === 0) return prev
          const merged = [...prev, ...fresh]
          merged.sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
          )
          return merged.slice(-500)
        })
      })
      .catch(() => {}) // cache-only fallback is fine
  }, [sdkMode, isGuest])

  // Live SSE feed — active only when live mode is on.
  // Browser EventSource sends session cookies automatically (same-origin), so
  // no API key is needed for in-browser live mode.
  const { rows: liveRows, connected: liveConnected, clear: clearLiveRows } = useLiveExecutions({
    enabled: sdkMode,
    digitalTwinId: selectedDigitalTwinId,
    apiKey: null, // session cookie handles auth for browser EventSource
    initialRows: initialLiveRows,
  })

  // When a synthetic row arrives, mirror it into local results state so CircuitResults updates
  useEffect(() => {
    if (!synthLastRow) return
    setDtHistoryRows((prev) => {
      const next = [...prev.filter((r) => r.id !== synthLastRow.id), synthLastRow]
      next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      return next.slice(-500)
    })
    setResults((prev: any) => ({
      ...prev,
      success_rate: synthLastRow.success_rate ?? prev?.success_rate ?? 0,
      runtime_ms:   synthLastRow.runtime_ms   ?? prev?.runtime_ms   ?? 0,
      fidelity:     synthLastRow.circuit_data?.fidelity ?? prev?.fidelity ?? 95,
      total_shots:  synthLastRow.shots        ?? prev?.total_shots   ?? 1024,
      qubits_used:  synthLastRow.qubits_used  ?? prev?.qubits_used   ?? qubits,
      backend_selected: synthLastRow.backend_selected ?? prev?.backend_selected ?? backend,
      error_mitigation: synthLastRow.error_mitigation ?? prev?.error_mitigation ?? "auto",
      counts:       synthLastRow.circuit_data?.counts ?? prev?.counts ?? {},
      algorithm:    synthLastRow.algorithm    ?? circuitName,
      circuit_name: synthLastRow.circuit_name ?? prev?.circuit_name,
      _liveJobId:   synthLastRow.id,
    }))
    refreshStorageEstimate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [synthLastRow])

  // When a new live row arrives, update results + circuit display from the latest job
  useEffect(() => {
    if (!sdkMode || liveRows.length === 0) return
    // Don't restore results if user explicitly cleared them
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("runner_results_cleared") === "1") return
    const latest = liveRows[liveRows.length - 1]
    // Map ExecutionRow shape to the results shape CircuitResults expects
    setResults((prev: any) => {
      const next = {
        ...prev,
        success_rate: latest.success_rate ?? prev?.success_rate ?? 0,
        runtime_ms:   latest.runtime_ms   ?? prev?.runtime_ms   ?? 0,
        fidelity:     latest.circuit_data?.fidelity ?? prev?.fidelity ?? 95,
        total_shots:  latest.shots        ?? prev?.total_shots   ?? 1024,
        qubits_used:  latest.qubits_used  ?? prev?.qubits_used   ?? qubits,
        backend_selected: latest.backend_selected ?? prev?.backend_selected ?? backend,
        error_mitigation: latest.error_mitigation ?? prev?.error_mitigation ?? "none",
        counts:       latest.circuit_data?.counts ?? prev?.counts ?? {},
        algorithm:    latest.algorithm    ?? circuitName,
        circuit_name: latest.circuit_name ?? prev?.circuit_name,
        digital_twin: prev?.digital_twin,
        _liveJobId:   latest.id,
      }
      return next
    })
    // Update displayed qubit count from live job
    if (latest.qubits_used) setQubits(latest.qubits_used)
    if (latest.algorithm)   setCircuitName(latest.algorithm)
    if (latest.backend_selected) setBackend(latest.backend_selected as any)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRows, sdkMode])

  useEffect(() => {
    const algorithmFromTemplates = sessionStorage.getItem("selectedAlgorithm")
    if (algorithmFromTemplates) {
      setSelectedAlgorithm(algorithmFromTemplates)
      setCircuitName(algorithmFromTemplates)
      sessionStorage.removeItem("selectedAlgorithm")
    }

    const savedState = sessionStorage.getItem("runner_state")
    if (savedState && !algorithmFromTemplates) {
      try {
        const state = JSON.parse(savedState)
        setExecutionName(state.executionName || "")
        setCircuitName(state.circuitName || "")
        setExecutionType(state.executionType || "auto")
        setBackend(state.backend || "quantum_inspired_gpu")
        setShots(state.shots || null)
        setAutoShots(state.autoShots || null)
        setQubits(state.qubits || 4)
        setErrorMitigation(state.errorMitigation || "auto")
        setCircuitCode(state.circuitCode || "")
        setCircuitData(state.circuitData || null)
        setDataUploaded(state.dataUploaded || false)
        setUploadedData(state.uploadedData || null)
        setCircuitImageUrl(state.circuitImageUrl || null)
        setTargetLatency(state.targetLatency || null)
      } catch (err) {
        // Error restoring state
      }
    }
  }, [])

  useEffect(() => {
    const state = {
      executionName,
      circuitName,
      executionType,
      backend,
      shots,
      autoShots,
      qubits,
      errorMitigation,
      circuitCode,
      circuitData,
      dataUploaded,
      uploadedData,
      circuitImageUrl,
      targetLatency,
      mlRecommendation,
    }
    sessionStorage.setItem("runner_state", JSON.stringify(state))
  }, [
    executionName,
    circuitName,
    executionType,
    backend,
    shots,
    autoShots,
    qubits,
    errorMitigation,
    circuitCode,
    circuitData,
    dataUploaded,
    uploadedData,
    circuitImageUrl,
    targetLatency,
    mlRecommendation,
  ])

  useEffect(() => {
    if (executionType === "auto" && circuitData && uploadedData) {
      fetchMLRecommendations()
    }
  }, [circuitData, uploadedData, executionType, errorMitigation, targetLatency])

  const fetchMLRecommendations = async () => {
    if (!circuitData || !uploadedData) return

    try {
      const response = await fetch("/api/quantum/ml-recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qubits: circuitData.qubits,
          depth: circuitData.depth,
          gateCount: circuitData.gates.length,
          algorithm: circuitName,
          dataSize: JSON.stringify(uploadedData).length,
          dataComplexity: Array.isArray(uploadedData) ? uploadedData.length / 100 : 0.5,
          targetLatency: targetLatency || 0,
          errorMitigation,
        }),
      })

      if (!response.ok) {
        // Fall back to adaptive shots calculation if ML service fails
const adaptiveShots = calculateAdaptiveShots({
            qubits: circuitData.qubits,
            depth: circuitData.depth,
            gates: circuitData.gates.length,
          })
        if (adaptiveShots !== autoShots) {
          setAutoShots(adaptiveShots)
        }
        return
      }

      const data = await response.json()
      if (data.success) {
        setMlRecommendation({
          shots: data.recommendedShots,
          backend: data.recommendedBackend,
          errorMitigation: data.recommendedErrorMitigation,
          confidence: data.confidence,
        })
        setAutoShots(data.recommendedShots)

        if (executionType === "auto") {
          setBackend(data.recommendedBackend as any)
          // Don't override errorMitigation state -- server resolves "auto"
          // at execution time using the same ML data
        }
      } else {
        // Fall back to adaptive calculation
        const adaptiveShots = calculateAdaptiveShots({
          qubits: circuitData.qubits,
          depth: circuitData.depth,
          gates: circuitData.gates.length,
        })
        setAutoShots(adaptiveShots)
      }
    } catch (error) {
      const adaptiveShots = calculateAdaptiveShots({
        qubits: circuitData.qubits,
        depth: circuitData.depth,
        gates: circuitData.gates.length,
      })
      setAutoShots(adaptiveShots)
    }
  }

  // Thin wrapper: delegates to lib/circuit-utils so runner and API stay in sync.
  const calculateAdaptiveShots = useCallback(
    (circuitParams: { qubits: number; depth: number; gates: number }) => {
      const base = Math.round(512 * Math.pow(2, (circuitParams.qubits - 4) / 6))
      const depthBonus = Math.floor(circuitParams.depth / 15) * 128
      const gateBonus  = Math.floor(circuitParams.gates / 25) * 64
      return Math.min(8192, Math.max(512, base + depthBonus + gateBonus))
    },
    [],
  )

  const handleDataUpload = useCallback(
    async (uploadedData: any) => {
      setUploadedData(uploadedData)

      try {
        let dataStructure = "simple"
        let dataDimensions = 1
        let dataSize = 10

        if (Array.isArray(uploadedData)) {
          dataSize = uploadedData.length
          if (Array.isArray(uploadedData[0])) {
            dataStructure = "matrix"
            dataDimensions = 2
            dataSize = uploadedData.length * uploadedData[0].length
          } else {
            dataStructure = "array"
          }
        } else if (typeof uploadedData === "object" && uploadedData !== null) {
          if (uploadedData.raw && uploadedData.type === "csv") {
            dataStructure = "table"
            const rows = uploadedData.raw.split("\n").filter((r: string) => r.trim())
            dataSize = rows.length - 1
          } else {
            dataStructure = "object"
            dataSize = Object.keys(uploadedData).length
          }
        }

        const response = await fetch("/api/quantum/generate-circuit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            algorithm: circuitName,
            inputData: uploadedData,
            qubits: uploadedData.qubits || Math.max(2, Math.ceil(Math.log2(dataSize))),
            shots: executionType === "auto" ? (autoShots || calculateAdaptiveShots({ qubits, depth: circuitData?.depth || 10, gates: circuitData?.gates.length || 20 })) : (shots || 1024),
            errorMitigation,
            dataMetadata: {
              structure: dataStructure,
              dimensions: dataDimensions,
              size: dataSize,
            },
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`API returned ${response.status}: ${errorText}`)
        }

        const data = await response.json()

        if (data.success) {
          setCircuitCode(data.qasm)
          setCircuitData({
            qubits: data.qubits,
            gates: data.gates,
            depth: data.depth,
          })
          setQubits(data.qubits)
          setDataUploaded(true)

          const vizResponse = await fetch("/api/quantum/visualize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ qasm: data.qasm }),
          })

          if (vizResponse.ok) {
            const vizData = await vizResponse.json()
            if (vizData.success && vizData.image_data) {
              if (vizData.format === "svg") {
                const svgBlob = new Blob([vizData.image_data], { type: "image/svg+xml" })
                const svgUrl = URL.createObjectURL(svgBlob)
                setCircuitImageUrl(svgUrl)
              } else {
                setCircuitImageUrl(`data:image/png;base64,${vizData.image_data}`)
              }
            }
          } else {
            console.error("[v0] Visualization API error:", await vizResponse.text())
          }

          if (executionType === "auto") {
            const optimal = selectOptimalBackend({
              qubits: data.qubits,
              depth: data.depth,
              gateCount: data.gates.length,
            })
            setBackend(optimal)
          }

          const adaptiveShots = data.recommendedShots ?? calculateAdaptiveShots({
            qubits: data.qubits,
            depth: data.depth,
            gates: data.gates.length,
          })
          setAutoShots(adaptiveShots)
        } else {
          console.error("[v0] Circuit generation failed:", data.error)
        }
      } catch (error) {
        console.error("[v0] Failed to generate circuit:", error)
        setDataUploaded(false)
      }
    },
    [circuitName, executionType, qubits, shots, errorMitigation, targetLatency, calculateAdaptiveShots],
  )

  const handleSaveCode = useCallback(() => {
    setIsCodeEditable(false)
  }, [circuitCode])

  const handleAutoParse = useCallback((parsedData: { gates: number; depth: number; qubitsUsed: number }) => {
    setQubits(parsedData.qubitsUsed)

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("circuit-parsed", {
          detail: {
            gates: parsedData.gates,
            depth: parsedData.depth,
            qubitsUsed: parsedData.qubitsUsed,
          },
        }),
      )
    }
  }, [])

  const handleRunCircuit = useCallback(async () => {
    if (isGuest) {
      alert("Create a free account or sign in to run quantum circuits.")
      return
    }
    // Client-side proactive storage block
    if (storageUsedBytes >= STORAGE_CAP_BYTES) {
      alert("Storage limit reached (50 MB). Delete some execution history in Settings → Execution History & Storage to free space.")
      return
    }
    setIsRunning(true)

    try {
      // New run — allow DTDashboard to populate from fresh results
      if (typeof sessionStorage !== "undefined") sessionStorage.removeItem("runner_results_cleared")

      const transpileResponse = await fetch("/api/quantum/transpile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qasm: circuitCode,
          // In auto mode pass "auto" so the server chooses the backend via policy engine
          backend: executionType === "auto" ? "auto" : backend,
          errorMitigation,
        }),
      })

      const transpileData = await transpileResponse.json()

      if (!transpileData.success) {
        throw new Error("Transpilation failed")
      }

      const simulateResponse = await fetch("/api/quantum/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qasm: transpileData.transpiledQASM,
          shots: executionType === "auto" ? (autoShots || calculateAdaptiveShots({ qubits, depth: circuitData?.depth || 10, gates: circuitData?.gates.length || 20 })) : (shots || 1024),
          backend: executionType === "auto" ? "auto" : backend,
          errorMitigation,
          circuitName: executionName || `${circuitName} Execution`,
          algorithm: circuitName,
          executionType,
          qubits,
          targetLatency,
          inputData: uploadedData,
          // Scenario / batch metadata
          scenarioId: currentBatchId ? `${currentBatchId}-scenario` : `scenario-${Date.now()}`,
          scenarioName: scenarioName || `${systemType} · ${scenarioType}`,
          scenarioType,
          objective: scenarioObjective,
          riskTolerance,
          strategy: executionStrategy,
        }),
      })

      const simulateData = await simulateResponse.json()

      if (!simulateData.success) {
        if (simulateData.storage_limit_exceeded) {
          throw new Error(`Storage limit reached (${simulateData.used_mb} MB / 50 MB). Go to Settings → Execution History & Storage to free space.`)
        }
        throw new Error("Simulation failed")
      }

      const digitalTwinResponse = await fetch("/api/quantum/digital-twin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          algorithm: circuitName,
          inputData: uploadedData,
          circuitInfo: {
            qubits,
            depth: circuitData?.depth || 0,
            gates: circuitData?.gates || [],
            qasm: circuitCode,
          },
          executionResults: {
            counts: simulateData.counts,
            shots: simulateData.total_shots || shots,
            success_rate: simulateData.successRate,
            runtime_ms: simulateData.runtime,
            execution_id: simulateData.execution_id,
          },
          backendConfig: {
            backend: simulateData.backend || backend,
            error_mitigation: simulateData.error_mitigation || errorMitigation,
            transpiled: true,
            noise_model: backend === "quantum_qpu" ? "realistic" : "ideal",
          },
        }),
      })

      const digitalTwinData = await digitalTwinResponse.json()

      const baseResults = {
        success_rate: simulateData.successRate,
        runtime_ms: simulateData.runtime,
        qubits_used: qubits,
        total_shots: simulateData.total_shots || (executionType === "auto" ? (autoShots || calculateAdaptiveShots({ qubits, depth: circuitData?.depth || 10, gates: circuitData?.gates.length || 20 })) : (shots || 1024)),
        // Prefer the server-resolved backend (important: in auto mode the client sends "auto",
        // so the server policy engine picks the real backend — always use the server value here)
        backend: simulateData.backend ?? backend,
        fidelity: simulateData.fidelity,
        counts: simulateData.counts,
        error_mitigation: simulateData.error_mitigation || errorMitigation,
        error_mitigation_requested: simulateData.error_mitigation_requested || errorMitigation,
        ml_tuning: simulateData.ml_tuning || null,
        backendReason: simulateData.backendReason || null,
        ...(digitalTwinData.success ? { digital_twin: digitalTwinData.digital_twin } : {}),
      }

      setResults(baseResults)

      // Update the client backend state to reflect what the server actually chose
      // (so the Execution Settings panel stays in sync after an auto run)
      if (simulateData.backend && executionType === "auto") {
        setBackend(simulateData.backend as any)
      }

      // Persist this execution to localStorage so the dashboard shows it after
      // a server cold-start (Vercel ephemeral /tmp SQLite is wiped between instances).
      try {
        const execRow = resultToRow(
          { ...baseResults, _liveJobId: simulateData.execution_id || `manual-${Date.now()}` },
          {
            circuitName: executionName || `${circuitName} Execution`,
            shots: baseResults.total_shots,
            qubits,
            backend: simulateData.backend || backend,
            errorMitigation: simulateData.error_mitigation || errorMitigation,
            digitalTwinId: selectedDigitalTwinId,
            qasm: circuitCode || null,
          },
        )
        const raw = localStorage.getItem("planck_exec_cache")
        const existing: any[] = raw ? JSON.parse(raw) : []
        const updated = [execRow, ...existing.filter((r: any) => r.id !== execRow.id)].slice(0, 500)
        localStorage.setItem("planck_exec_cache", JSON.stringify(updated))
        // Broadcast to dashboard and any other open pages for instant update
        broadcastExecution(execRow)
        // Keep local DTDashboard history in sync
        setDtHistoryRows((prev) => {
          const next = [...prev.filter((r) => r.id !== execRow.id), execRow]
          next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          return next.slice(-500)
        })
        // Refresh local storage estimate so banner updates immediately
        refreshStorageEstimate()
      } catch {
        // localStorage unavailable — fail silently; server DB is the primary store
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsRunning(false)
    }
  }, [
    circuitCode,
    backend,
    qubits,
    autoShots,
    shots,
    errorMitigation,
    executionName,
    circuitName,
    executionType,
    targetLatency,
    storageUsedBytes,
    STORAGE_CAP_BYTES,
  ])

  const handleDownloadCircuitImage = useCallback(() => {
    if (!circuitImageUrl) return

    const link = document.createElement("a")
    link.href = circuitImageUrl
    const extension = circuitImageUrl.startsWith("blob:") ? "svg" : "png"
    link.download = `${circuitName.replace(/\s+/g, "_")}_circuit.${extension}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [circuitName, circuitImageUrl])

  const handleDownloadCircuitCode = useCallback(() => {
    const blob = new Blob([circuitCode || 'OPENQASM 2.0;\ninclude "qelib1.inc";'], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${circuitName.replace(/\s+/g, "_")}_code.qasm`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [circuitCode, circuitName])

  const handleDownloadResults = useCallback(() => {
    if (!results) return

    const downloadData = {
      ...results,
      qasm: circuitCode || null,
      metadata: {
        execution_name: executionName,
        circuit_name: circuitName,
        algorithm: selectedAlgorithm,
        execution_type: executionType,
        qubits,
        shots: shots || autoShots,
        backend,
        error_mitigation: errorMitigation,
        target_latency: targetLatency,
        timestamp: new Date().toISOString(),
        ml_recommendations: mlRecommendation
          ? {
              recommended_shots: mlRecommendation.shots,
              recommended_backend: mlRecommendation.backend,
              recommended_error_mitigation: mlRecommendation.errorMitigation,
              confidence: mlRecommendation.confidence,
              execution_type_used: executionType,
            }
          : null,
      },
    }

    const resultsData = JSON.stringify(downloadData, null, 2)
    const blob = new Blob([resultsData], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${circuitName.replace(/\s+/g, "_")}_results.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [
    results,
    circuitCode,
    circuitName,
    executionName,
    selectedAlgorithm,
    executionType,
    qubits,
    shots,
    autoShots,
    backend,
    errorMitigation,
    targetLatency,
    mlRecommendation,
  ])

  const handleSaveCircuit = useCallback(async () => {
    const allBackendResults = {
      quantum_inspired_gpu: {
        name: "Quantum Inspired GPU",
        fidelity: calculateFidelity("quantum_inspired_gpu", qubits, circuitData?.gates.length || 20),
        runtime: estimateRuntime(Math.pow(2, qubits), true),
      },
      hpc_gpu: {
        name: "HPC GPU",
        fidelity: calculateFidelity("hpc_gpu", qubits, circuitData?.gates.length || 20),
        runtime: estimateRuntime(Math.pow(2, qubits), true) * 0.7,
      },
      quantum_qpu: {
        name: "Quantum QPU",
        fidelity: calculateFidelity("quantum_qpu", qubits, circuitData?.gates.length || 20),
        runtime: estimateRuntime(Math.pow(2, qubits), true) * 1.2,
      },
    }

    const circuitSnapshot = {
      circuit_name: executionName || `${circuitName} Execution`,
      algorithm: circuitName,
      execution_type: executionType,
      circuit_settings: {
        shots: executionType === "auto" ? (autoShots || calculateAdaptiveShots({ qubits, depth: circuitData?.depth || 10, gates: circuitData?.gates.length || 20 })) : (shots || 1024),
        error_mitigation: errorMitigation,
      },
      execution_settings: {
        backend,
        qubits,
        depth: circuitData?.depth || 0,
      },
      expected_results_all_backends: allBackendResults,
      circuit_code_qasm: circuitCode,
      circuit_data: circuitData,
      results,
      timestamp: new Date().toISOString(),
      target_latency: targetLatency,
    }

    const blob = new Blob([JSON.stringify(circuitSnapshot, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${(executionName || circuitName).replace(/\s+/g, "_")}_${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    // TODO: Implement save to internal DB via /api/ endpoint.
  }, [
    executionName,
    circuitName,
    executionType,
    backend,
    shots,
    autoShots,
    qubits,
    errorMitigation,
    circuitCode,
    circuitData,
    results,
    targetLatency,
  ])

  const handleReset = useCallback(() => {
    setExecutionName("")
    setCircuitName("")
    setExecutionType("auto")
    setBackend("quantum_inspired_gpu")
    setShots(null)
    setAutoShots(1024)
    setQubits(4)
    setErrorMitigation("none")
    setResults(null)
    setCircuitCode("")
    setCircuitData(null)
    setIsCodeEditable(false)
    setDataUploaded(false)
    setUploadedData(null)
    setCircuitImageUrl(null)
    setSelectedAlgorithm(null)
    setTargetLatency(null)
    setMlRecommendation(null)
    setBatchResults([])
    setBatchProgress(null)
    setCurrentBatchId(null)
    clearLiveRows()
    sessionStorage.removeItem("runner_state")
    sessionStorage.removeItem("selectedAlgorithm")
  }, [clearLiveRows])

  const handleClearResults = useCallback(() => {
    setResults(null)
    setBatchResults([])
    setBatchProgress(null)
    clearLiveRows()
    setInitialLiveRows([])
    setDtHistoryRows([])
    setClearKey((k) => k + 1)
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem("runner_results_cleared", "1")
  }, [clearLiveRows])

  // ── Batch run handler ────────────────────────────────────────────────────
  const handleBatchRun = useCallback(async () => {
    if (isGuest) {
      alert("Create a free account or sign in to run simulations.")
      return
    }
    if (storageUsedBytes >= STORAGE_CAP_BYTES) {
      alert("Storage limit reached (50 MB). Delete some execution history in Settings → Execution History & Storage to free space.")
      return
    }
    const total = executionStrategy === "single" ? 1 : batchSize
    const bId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setCurrentBatchId(bId)
    setBatchResults([])
    setBatchProgress({ current: 0, total })
    setIsRunning(true)

    const collected: any[] = []
    try {
      for (let i = 0; i < total; i++) {
        setBatchProgress({ current: i + 1, total })
        if (typeof sessionStorage !== "undefined") sessionStorage.removeItem("runner_results_cleared")

        const transpileResponse = await fetch("/api/quantum/transpile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            qasm: circuitCode,
            backend: executionType === "auto" ? "auto" : backend,
            errorMitigation,
          }),
        })
        const transpileData = await transpileResponse.json()
        if (!transpileData.success) throw new Error("Transpilation failed")

        // Map risk tolerance → backend hint for auto-routing
        let backendHint = executionType === "auto" ? "auto" : backend
        if (executionType === "auto") {
          if (riskTolerance === "conservative") backendHint = "hpc_gpu"
          else if (riskTolerance === "aggressive") backendHint = "quantum_qpu"
        }

        const simulateResponse = await fetch("/api/quantum/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            qasm: transpileData.transpiledQASM,
            shots: executionType === "auto" ? (autoShots || calculateAdaptiveShots({ qubits, depth: circuitData?.depth || 10, gates: circuitData?.gates.length || 20 })) : (shots || 1024),
            backend: backendHint,
            errorMitigation,
            circuitName: executionName || `${circuitName} ${total > 1 ? `Run ${i + 1}/${total}` : ""}`.trim(),
            algorithm: circuitName,
            executionType,
            qubits,
            targetLatency,
            inputData: uploadedData,
            scenarioId: `${bId}-scenario`,
            scenarioName: scenarioName || `${systemType} · ${scenarioType}`,
            scenarioType,
            objective: scenarioObjective,
            riskTolerance,
            batchId: total > 1 ? bId : null,
            batchIndex: total > 1 ? i : null,
            batchSize: total > 1 ? total : null,
            strategy: executionStrategy,
          }),
        })
        const simulateData = await simulateResponse.json()
        if (!simulateData.success) {
          if (simulateData.storage_limit_exceeded) throw new Error(`Storage limit reached.`)
          throw new Error("Simulation failed")
        }

        const digitalTwinResponse = await fetch("/api/quantum/digital-twin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            algorithm: circuitName,
            inputData: uploadedData,
            circuitInfo: { qubits, depth: circuitData?.depth || 0, gates: circuitData?.gates || [], qasm: circuitCode },
            executionResults: { counts: simulateData.counts, shots: simulateData.total_shots || shots, success_rate: simulateData.successRate, runtime_ms: simulateData.runtime, execution_id: simulateData.execution_id },
            backendConfig: { backend: simulateData.backend || backend, error_mitigation: simulateData.error_mitigation || errorMitigation, transpiled: true, noise_model: backend === "quantum_qpu" ? "realistic" : "ideal" },
          }),
        })
        const digitalTwinData = await digitalTwinResponse.json()

        const runResult = {
          success_rate: simulateData.successRate,
          runtime_ms: simulateData.runtime,
          qubits_used: qubits,
          total_shots: simulateData.total_shots || shots || 1024,
          backend: simulateData.backend ?? backend,
          fidelity: simulateData.fidelity,
          counts: simulateData.counts,
          error_mitigation: simulateData.error_mitigation || errorMitigation,
          ml_tuning: simulateData.ml_tuning || null,
          backendReason: simulateData.backendReason || null,
          batchIndex: i,
          batchId: bId,
          ...(digitalTwinData.success ? { digital_twin: digitalTwinData.digital_twin } : {}),
        }
        collected.push(runResult)
        setBatchResults([...collected])

        // Update displayed results with the latest run
        if (simulateData.backend && executionType === "auto") setBackend(simulateData.backend as any)
        setResults(runResult)

        // Persist to localStorage
        try {
          const execRow = resultToRow(
            { ...runResult, _liveJobId: simulateData.execution_id || `batch-${bId}-${i}` },
            {
              circuitName: executionName || `${circuitName} ${total > 1 ? `Run ${i + 1}/${total}` : ""}`.trim(),
              shots: runResult.total_shots,
              qubits,
              backend: simulateData.backend || backend,
              errorMitigation: simulateData.error_mitigation || errorMitigation,
              digitalTwinId: selectedDigitalTwinId,
              qasm: circuitCode || null,
            },
          )
          const raw = localStorage.getItem("planck_exec_cache")
          const existing: any[] = raw ? JSON.parse(raw) : []
          const updated = [execRow, ...existing.filter((r: any) => r.id !== execRow.id)].slice(0, 500)
          localStorage.setItem("planck_exec_cache", JSON.stringify(updated))
          broadcastExecution(execRow)
          setDtHistoryRows((prev) => {
            const next = [...prev.filter((r) => r.id !== execRow.id), execRow]
            next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            return next.slice(-500)
          })
        } catch { /* non-fatal */ }

        // Small delay between runs to avoid rate limiting
        if (i < total - 1) await new Promise((resolve) => setTimeout(resolve, 3200))
      }
      refreshStorageEstimate()
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsRunning(false)
      setBatchProgress(null)
    }
  }, [
    circuitCode, backend, qubits, autoShots, shots, errorMitigation, executionName, circuitName,
    executionType, targetLatency, storageUsedBytes, STORAGE_CAP_BYTES, uploadedData, circuitData,
    selectedDigitalTwinId, systemType, scenarioName, scenarioType, scenarioObjective, riskTolerance,
    executionStrategy, batchSize, isGuest,
  ])

  return (
    <div className="p-8 space-y-8 px-0">
      <PageHeader
        title="Twin Simulator"
        description="Define your system scenario, then simulate it with quantum compute."
      />

      {/* Storage limit warning banner */}
      {!isGuest && storageUsedBytes >= STORAGE_CAP_BYTES && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-destructive/60 bg-destructive/10 text-sm">
          <span className="text-destructive font-bold mt-0.5">⚠</span>
          <div>
            <p className="font-semibold text-destructive">Execution history storage limit reached ({(storageUsedBytes / 1_048_576).toFixed(1)} MB / 50 MB)</p>
            <p className="text-destructive/80 text-xs mt-0.5">New executions are blocked. Go to <strong>Settings → Execution History &amp; Storage</strong> and delete some records to free space.</p>
          </div>
        </div>
      )}
      {!isGuest && storageUsedBytes >= STORAGE_CAP_BYTES * 0.8 && storageUsedBytes < STORAGE_CAP_BYTES && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-amber-500/60 bg-amber-500/10 text-sm">
          <span className="text-amber-600 font-bold mt-0.5">⚠</span>
          <div>
            <p className="font-semibold text-amber-700 dark:text-amber-400">Execution history approaching limit ({(storageUsedBytes / 1_048_576).toFixed(1)} MB / 50 MB)</p>
            <p className="text-amber-600/80 dark:text-amber-400/70 text-xs mt-0.5">Consider freeing space in <strong>Settings → Execution History &amp; Storage</strong> before it fills up.</p>
          </div>
        </div>
      )}

      {/* ── Scenario Setup Panel ─────────────────────────────────────────── */}
      <Card className="p-5 shadow-lg border border-primary/15">
        <div className="flex items-center gap-2 mb-4">
          <Layers size={16} className="text-primary" />
          <h2 className="text-base font-semibold text-foreground">System &amp; Scenario</h2>
          <span className="ml-auto text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-medium">Step 1</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Digital Twin / System Label */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Digital Twin / System</label>
            <select
              value={systemType}
              onChange={(e) => setSystemType(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {["Mobility", "Energy", "Finance", "Logistics", "Materials", "Healthcare", "Custom"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          {/* Scenario Name */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Scenario Name</label>
            <input
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="e.g., Peak Load 2026"
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {/* Scenario Type */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Scenario Type</label>
            <div className="flex flex-wrap gap-1.5">
              {(["Baseline", "Stress test", "Optimization", "Risk analysis", "Custom"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setScenarioType(v)}
                  className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                    scenarioType === v
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          {/* Objective */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <Target size={11} /> Objective
            </label>
            <select
              value={scenarioObjective}
              onChange={(e) => setScenarioObjective(e.target.value as any)}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="minimize_runtime">Minimize runtime</option>
              <option value="maximize_reliability">Maximize reliability</option>
              <option value="minimize_cost">Minimize cost</option>
              <option value="maximize_accuracy">Maximize accuracy</option>
              <option value="balanced">Balanced</option>
            </select>
          </div>
          {/* Risk Tolerance */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <Shield size={11} /> Risk Tolerance
            </label>
            <div className="flex gap-1.5">
              {(["conservative", "balanced", "aggressive"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRiskTolerance(r)}
                  className={`flex-1 py-2 px-1 rounded-md text-xs font-medium transition-colors capitalize ${
                    riskTolerance === r
                      ? r === "conservative" ? "bg-blue-600 text-white"
                        : r === "aggressive" ? "bg-orange-600 text-white"
                        : "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r === "conservative" ? "🛡 Conserv." : r === "balanced" ? "⚖ Balanced" : "⚡ Aggressive"}
                </button>
              ))}
            </div>
          </div>
          {/* Execution Strategy */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <BarChart3 size={11} /> Execution Strategy
            </label>
            <div className="flex gap-1.5">
              {([
                { v: "single" as const, label: "Single run" },
                { v: "batch" as const, label: "Batch" },
                { v: "compare" as const, label: "Compare" },
              ] as const).map(({ v, label }) => (
                <button
                  key={v}
                  onClick={() => {
                    setExecutionStrategy(v)
                    if (v === "single") setBatchSize(1)
                    else if ((v === "batch" || v === "compare") && batchSize === 1) setBatchSize(3)
                  }}
                  className={`flex-1 py-2 px-1 rounded-md text-xs font-medium transition-colors ${
                    executionStrategy === v
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Batch size selector — visible in batch/compare mode */}
        {(executionStrategy === "batch" || executionStrategy === "compare") && (
          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground">Number of runs:</span>
            {([1, 3, 5, 10] as const).map((n) => (
              <button
                key={n}
                onClick={() => setBatchSize(n)}
                className={`w-10 h-8 rounded-md text-sm font-semibold transition-colors ${
                  batchSize === n ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/70"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        )}

        {/* Scenario summary badge */}
        {(scenarioName || systemType !== "Custom") && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-primary inline-block flex-shrink-0" />
            <span className="font-medium text-foreground">{systemType}</span>
            {scenarioName && <span>· {scenarioName}</span>}
            <span>· {scenarioType}</span>
            <span>· {scenarioObjective.replace("_", " ")}</span>
            <span>· {riskTolerance}</span>
            {executionStrategy !== "single" && <span className="text-primary font-medium">· {batchSize} runs</span>}
          </div>
        )}
      </Card>

      {/* ── Risk-aware insight layer ────────────────────────────────────────── */}
      {(() => {
        const insights: string[] = []
        if (riskTolerance === "conservative") insights.push("🛡 Conservative strategy selected: prioritizing stability over runtime. Auto-routing will prefer Quantum-inspired HPC.")
        else if (riskTolerance === "aggressive") insights.push("⚡ Aggressive strategy selected: faster route with higher variability. Auto-routing may select Quantum QPU.")
        if (scenarioObjective === "minimize_runtime" && riskTolerance === "conservative") insights.push("⚠ Note: minimize runtime and conservative risk may conflict — consider balanced strategy.")
        if (scenarioObjective === "maximize_reliability") insights.push("Reliability objective active: error mitigation will be prioritized.")
        if (executionStrategy === "batch" && batchSize >= 5) insights.push(`Batch mode: ${batchSize} simulations will run sequentially and be compared after completion.`)
        if (batchResults.length >= 2) {
          const avgSuccess = batchResults.reduce((s, r) => s + (r.success_rate || 0), 0) / batchResults.length
          const maxSuccess = Math.max(...batchResults.map((r) => r.success_rate || 0))
          const minSuccess = Math.min(...batchResults.map((r) => r.success_rate || 0))
          const variance = maxSuccess - minSuccess
          if (variance > 15) insights.push(`⚠ This batch shows high variability (${variance.toFixed(1)}pp spread). Consider conservative routing for more stable results.`)
          else insights.push(`✓ Batch variability is low (${variance.toFixed(1)}pp). Results are stable across runs.`)
          if (batchResults.length > 1) {
            const baseline = batchResults[0]
            const best = batchResults.reduce((a, b) => (b.success_rate > a.success_rate ? b : a))
            if (best.runtime_ms && baseline.runtime_ms && best.runtime_ms < baseline.runtime_ms) {
              const pct = (((baseline.runtime_ms - best.runtime_ms) / baseline.runtime_ms) * 100).toFixed(1)
              insights.push(`Best run improved runtime by ${pct}% compared to the first run.`)
            }
          }
        }
        if (insights.length === 0) return null
        return (
          <div className="space-y-2">
            {insights.map((msg, i) => (
              <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg border border-border bg-secondary/30 text-xs text-muted-foreground">
                <span className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
                {msg}
              </div>
            ))}
          </div>
        )
      })()}

      {/* ── Batch progress indicator ─────────────────────────────────────── */}
      {batchProgress && (
        <Card className="p-4 border border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="text-primary animate-spin" />
              <span className="text-sm font-semibold text-foreground">
                Running simulation {batchProgress.current} of {batchProgress.total}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">{Math.round((batchProgress.current / batchProgress.total) * 100)}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
            />
          </div>
          {batchResults.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Last: {batchResults[batchResults.length - 1]?.success_rate?.toFixed(1)}% success · {batchResults[batchResults.length - 1]?.runtime_ms}ms
            </p>
          )}
        </Card>
      )}

      {/* ── Batch results comparison ─────────────────────────────────────── */}
      {batchResults.length >= 2 && !batchProgress && (
        <Card className="p-5 border border-border shadow">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={15} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Scenario Output · Batch Comparison</h3>
            <span className="ml-auto text-xs text-muted-foreground">{batchResults.length} runs</span>
          </div>
          {/* Summary metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {(() => {
              const avgSuccess = batchResults.reduce((s, r) => s + (r.success_rate || 0), 0) / batchResults.length
              const avgRuntime = batchResults.reduce((s, r) => s + (r.runtime_ms || 0), 0) / batchResults.length
              const best = batchResults.reduce((a, b) => (b.success_rate > a.success_rate ? b : a))
              const fastest = batchResults.reduce((a, b) => (b.runtime_ms < a.runtime_ms ? b : a))
              return (
                <>
                  <div className="text-center px-3 py-2 rounded-lg bg-secondary/40">
                    <p className="text-xs text-muted-foreground">Avg Reliability</p>
                    <p className="text-lg font-bold text-foreground">{avgSuccess.toFixed(1)}%</p>
                  </div>
                  <div className="text-center px-3 py-2 rounded-lg bg-secondary/40">
                    <p className="text-xs text-muted-foreground">Avg Runtime</p>
                    <p className="text-lg font-bold text-foreground">{Math.round(avgRuntime)}ms</p>
                  </div>
                  <div className="text-center px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                    <p className="text-xs text-muted-foreground">Best Reliability</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">{best.success_rate?.toFixed(1)}%</p>
                    <p className="text-[10px] text-muted-foreground">Run {best.batchIndex + 1}</p>
                  </div>
                  <div className="text-center px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <p className="text-xs text-muted-foreground">Fastest Run</p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{fastest.runtime_ms}ms</p>
                    <p className="text-[10px] text-muted-foreground">Run {fastest.batchIndex + 1}</p>
                  </div>
                </>
              )
            })()}
          </div>
          {/* Runs table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground text-left border-b border-border">
                  <th className="pb-2 pr-3 font-medium">Run</th>
                  <th className="pb-2 pr-3 font-medium">Compute Route</th>
                  <th className="pb-2 pr-3 font-medium">Reliability</th>
                  <th className="pb-2 pr-3 font-medium">Runtime</th>
                  <th className="pb-2 font-medium">Sampling</th>
                </tr>
              </thead>
              <tbody>
                {batchResults.map((r, i) => {
                  const routeLabel = r.backend === "quantum_inspired_gpu" ? "QI-GPU"
                    : r.backend === "hpc_gpu" ? "HPC"
                    : r.backend === "quantum_qpu" ? "QPU"
                    : r.backend || "—"
                  const maxSuccess = Math.max(...batchResults.map((x) => x.success_rate || 0))
                  const isBest = r.success_rate === maxSuccess
                  return (
                    <tr key={i} className={`border-b border-border/50 ${isBest ? "font-semibold" : ""}`}>
                      <td className="py-1.5 pr-3 text-foreground flex items-center gap-1">
                        {isBest && <span className="text-[10px] text-green-500">★</span>}
                        {i + 1}
                      </td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{routeLabel}</td>
                      <td className="py-1.5 pr-3" style={{ color: "#7ab5ac" }}>{r.success_rate?.toFixed(1)}%</td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{r.runtime_ms}ms</td>
                      <td className="py-1.5 text-muted-foreground">{r.total_shots}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Synthetic Data mode toggle */}
      <div className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
        syntheticMode ? "border-[#7ab5ac]/40 bg-[#7ab5ac]/5" : "border-border bg-secondary/40"
      }`}>
        <div className="flex items-center gap-3">
          <FlaskConical size={18} className={syntheticMode ? "text-[#7ab5ac]" : "text-muted-foreground"} />
          <div>
            <p className="text-sm font-medium text-foreground">Synthetic Data mode</p>
            <p className="text-xs text-muted-foreground">
              {syntheticMode
                ? "Generating synthetic telemetry locally and feeding the quantum pipeline automatically."
                : "Enable to run parametrized synthetic data without writing code or using the remote SDK."}
            </p>
          </div>
        </div>
        <button
          role="switch"
          aria-checked={syntheticMode}
          onClick={() => setSyntheticMode((v) => !v)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ab5ac] ${
            syntheticMode ? "bg-[#7ab5ac]" : "bg-muted"
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            syntheticMode ? "translate-x-6" : "translate-x-1"
          }`} />
        </button>
      </div>

      {/* SDK / Intensive-use mode toggle */}
      <div className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
        sdkMode ? "border-primary/40 bg-primary/5" : "border-border bg-secondary/40"
      }`}>
        <div className="flex items-center gap-3">
          <Radio size={18} className={sdkMode ? "text-primary" : "text-muted-foreground"} />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">SDK / Live mode</p>
              {sdkMode && (
                <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  liveConnected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {liveConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
                  {liveConnected ? "Connected" : "Connecting…"}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {sdkMode
                ? "Results update in near real-time from SDK jobs. Upload and editing are disabled."
                : "Enable to receive live results from notebook/script SDK calls."}
            </p>
          </div>
        </div>
        <button
          role="switch"
          aria-checked={sdkMode}
          onClick={() => setLiveEnabled(!sdkMode)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            sdkMode ? "bg-primary" : "bg-muted"
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            sdkMode ? "translate-x-6" : "translate-x-1"
          }`} />
        </button>
      </div>

      {/* Digital Twin Selector — always visible */}
      <DigitalTwinSelector
        selectedTwinId={selectedDigitalTwinId}
        onSelect={setSelectedDigitalTwinId}
      />

      {/* ── Synthetic Data runner panel ───────────────────────────────── */}
      {syntheticMode && <SyntheticDataRunner />}

      {/* ── SDK live feed panel ─────────────────────────────────────────── */}
      {sdkMode && (
        <Card className="p-5 border border-primary/20 bg-primary/5 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Radio size={16} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Live SDK Feed</h3>
              {liveConnected && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{liveRows.length} job{liveRows.length !== 1 ? "s" : ""} received</p>
          </div>

          {liveRows.length === 0 ? (
            <div className="flex items-center justify-center py-8 rounded-lg border border-dashed border-border bg-secondary/30">
              <p className="text-sm text-muted-foreground">Waiting for SDK jobs… Run <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">user.run(data)</code> from your notebook.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {[...liveRows].reverse().map((row) => (
                <div key={row.id} className={`flex items-center justify-between px-3 py-2 rounded-md border text-xs transition-colors ${
                  row.id === (results as any)?._liveJobId ? "border-primary/40 bg-primary/10" : "border-border bg-secondary/30"
                }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${row.status === "completed" ? "bg-primary" : row.status === "running" ? "bg-accent" : "bg-destructive"}`} />
                    <span className="font-medium text-foreground truncate">{row.circuit_name || row.algorithm}</span>
                    <span className="text-muted-foreground capitalize hidden sm:inline">{row.algorithm}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 text-muted-foreground">
                    <span>{row.qubits_used}q</span>
                    <span>{row.runtime_ms}ms</span>
                    <span className="font-medium" style={{ color: "#7ab5ac" }}>{row.success_rate?.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Manual-mode setup sections (hidden in SDK / live mode) ────────── */}
      {!sdkMode && (
        <div className="space-y-4">
          <div>
            <label htmlFor="execution-name" className="block text-sm font-medium text-foreground mb-2">
              Simulation Name (Optional)
            </label>
            <input
              id="execution-name"
              type="text"
              value={executionName}
              onChange={(e) => setExecutionName(e.target.value)}
              placeholder={`e.g., "${systemType || circuitName} ${scenarioType}"`}
              className="w-full px-4 py-2 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">Optional label for this simulation run</p>
          </div>

          <div className="mt-4">
            <label htmlFor="target-latency" className="block text-sm font-medium text-foreground mb-2">
              Target Latency (Optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="target-latency"
                type="number"
                min="0"
                step="1"
                value={targetLatency || ""}
                onChange={(e) => setTargetLatency(e.target.value ? Number(e.target.value) : null)}
                placeholder="e.g., 1000"
                className="flex-1 px-4 py-2 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="text-sm font-medium text-muted-foreground">ms</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">QPU requires &gt;=500ms. Below that falls back to HPC.</p>
          </div>
        </div>
      )}

      {/* Mobile pipeline — hidden in SDK/live mode */}
      {!sdkMode && (
      <div className="lg:hidden space-y-6">
        {!isHidden('runner.database_uploader') && (
        <DatabaseUploader
          onDataUpload={handleDataUpload}
          preSelectedAlgorithm={selectedAlgorithm}
          onAlgorithmSelect={(algorithm) => {
            setCircuitName(algorithm)
          }}
        />
        )}
        {!isHidden('runner.autoparser') && (
        <AutoParser onParsed={handleAutoParse} inputData={uploadedData} algorithm={selectedAlgorithm ?? undefined} />
        )}
        {!isHidden('runner.circuit_settings') && (
        <div>
          <button
            onClick={() => setShowAdvancedQuantum((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-secondary/40 hover:bg-secondary/70 transition-colors text-sm font-semibold text-foreground mb-2"
          >
            <div className="flex items-center gap-2">
              <Settings2 size={15} className="text-muted-foreground" />
              Advanced Quantum Settings
            </div>
            <ChevronDown size={15} className={`text-muted-foreground transition-transform duration-200 ${showAdvancedQuantum ? "rotate-180" : ""}`} />
          </button>
          {showAdvancedQuantum && (
            <div className="space-y-4">
              <CircuitSettings
                onExecutionTypeChange={setExecutionType}
                onQubitsChange={setQubits}
                onErrorMitigationChange={setErrorMitigation}
              />
              {!isHidden('runner.execution_settings') && (
              <ExecutionSettings
                onBackendChange={setBackend}
                currentBackend={backend}
                onModeChange={setExecutionType}
                qubits={qubits}
                depth={circuitData?.depth || 20}
                postRunReason={results?.backendReason ?? null}
              />
              )}
            </div>
          )}
        </div>
        )}
        {!isHidden('runner.autoparser') && (
        <ExpectedResults backend={backend} qubits={qubits} depth={circuitData?.depth || 20} hasData={dataUploaded} />
        )}

        <div className="flex justify-center gap-3 pt-6 border-border border-t-2">
          <Button onClick={handleReset} variant="outline" className="flex items-center gap-2 bg-secondary">
            <RotateCcw size={18} />
            Reset
          </Button>
          <Button onClick={handleSaveCircuit} variant="outline" className="flex items-center gap-2 bg-secondary">
            <Save size={18} />
            Save
          </Button>
          <Button
            onClick={handleBatchRun}
            disabled={isRunning}
            className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {batchProgress ? `Run ${batchProgress.current}/${batchProgress.total}…` : "Simulating…"}
              </>
            ) : (
              <>
                <Play size={18} />
                {executionStrategy !== "single" ? `Simulate ${batchSize} runs` : "Simulate scenario"}
              </>
            )}
          </Button>
          </div>
        </div>
      )} {/* end !sdkMode mobile pipeline */}

      <div className={`grid grid-cols-1 gap-6 ${!sdkMode ? "lg:grid-cols-3" : ""}`}>
        <div className={`space-y-6 ${!sdkMode ? "lg:col-span-2" : ""}`}>
          {/* Execution Pipeline — manual mode only */}
          {!sdkMode && (
          <Card className="p-6 shadow-lg bg-card px-4 py-4">
            <h2 className="text-2xl font-bold text-foreground mb-4">Simulation Pipeline</h2>
            {!dataUploaded ? (
              <div className="rounded-lg min-h-64 border border-border border-dashed flex items-center justify-center bg-secondary/30">
                <p className="text-muted-foreground px-3 py-3">
                  Upload data and select an algorithm to start the pipeline
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full text-white font-bold" style={{ backgroundColor: "#7ab5ac" }}>
                    1
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">Data Uploaded</h3>
                    <p className="text-sm text-muted-foreground">
                      {circuitName} model with {qubits} quantum resources
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full text-white font-bold" style={{ backgroundColor: "#7ab5ac" }}>
                    2
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">Model Generated</h3>
                    <p className="text-sm text-muted-foreground">
                      {circuitData?.gates.length || 0} gate operations, depth {circuitData?.depth || 0}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full text-white font-bold" style={{ backgroundColor: results ? '#7ab5ac' : '#d1d5db' }}>
                    3
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">Scenario Simulation</h3>
                    {results ? (
                      <p className="text-sm text-muted-foreground">Completed in {results.runtime_ms}ms</p>
                    ) : executionType === "auto" && circuitData ? (
                      <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                        {mlRecommendation ? (
                          <>
                            <p>
                              <span className="text-foreground font-medium">Shots: </span>
                              {mlRecommendation.shots}
                              <span className="ml-1" style={{ color: '#7ab5ac' }}>(RL — {Math.round(mlRecommendation.confidence * 100)}% confidence)</span>
                            </p>
                            <p>
                              <span className="text-foreground font-medium">Mitigation: </span>
                              <span className="capitalize">{mlRecommendation.errorMitigation}</span>
                              <span className="ml-1" style={{ color: '#7ab5ac' }}>(auto)</span>
                            </p>
                          </>
                        ) : (
                          <>
                            <p>
                              <span className="text-foreground font-medium">Shots: </span>
                              {autoShots ?? calculateAdaptiveShots({ qubits, depth: circuitData.depth, gates: circuitData.gates.length })}
                              <span className="ml-1 text-muted-foreground">(adaptive)</span>
                            </p>
                            <p>
                              <span className="text-foreground font-medium">Mitigation: </span>
                              <span>auto</span>
                            </p>
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Ready to simulate</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full text-white font-bold" style={{ backgroundColor: results ? '#7ab5ac' : '#d1d5db' }}>
                    4
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">Insights Generated</h3>
                    <p className="text-sm text-muted-foreground">
                      {results ? `Success rate: ${results.success_rate.toFixed(2)}%` : 'Waiting for simulation'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Card>
          )} {/* end !sdkMode pipeline */}

          {/* Digital Twin Dashboard — always visible by default, shows execution history.
              BroadcastChannel inside useLiveExecutions auto-appends new runs instantly. */}
          {!isHidden('runner.digital_twin_dashboard') && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button
                  onClick={handleClearResults}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 text-muted-foreground hover:text-destructive hover:border-destructive/40"
                >
                  <Trash2 size={14} />
                  Clear previous results
                </Button>
              </div>
              <DigitalTwinDashboard
                key={`dt-${clearKey}`}
                liveEnabled={false}
                apiKey={null}
                digitalTwinId={selectedDigitalTwinId}
                initialRows={sdkMode ? liveRows : dtHistoryRows}
                title={selectedDigitalTwinId ? "Selected Digital Twin" : "Simulations — All Scenarios"}
              />
            </div>
          )}

          {/* Execution results — always shown in SDK mode; shown after a manual run otherwise */}
          {(results || sdkMode) ? (
            <div className="space-y-6">
              {/* RL backend selection announcement */}
              {results?.backendReason && !results.backendReason.startsWith("Manual selection:") && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-primary/20 bg-primary/5 text-sm">
                  <Brain size={16} className="text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-foreground">
                      <span className="font-medium">Automatic backend selection system based on Reinforcement Learning selected: </span>
                      <span className="font-bold" style={{ color: "#7ab5ac" }}>
                        {(
                          { quantum_inspired_gpu: "Quantum Inspired GPU", hpc_gpu: "HPC GPU", quantum_qpu: "Quantum QPU" } as Record<string, string>
                        )[results.backend] ?? results.backend}
                      </span>
                      <span className="font-medium"> as best choice.</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{results.backendReason}</p>
                  </div>
                </div>
              )}

              {/* Stable key so useAnimatedValue smoothly counts between values
                  instead of replaying from zero on every live row. */}
              {!isHidden('runner.circuit_results') && (
              <CircuitResults key={sdkMode ? "cr-live" : "static"} backend={backend} results={results} qubits={qubits} onDownload={handleDownloadResults} isLive={true} />
              )}

              {results && uploadedData && circuitCode && !isHidden('runner.digital_twin_panel') && (
                <DigitalTwinPanel
                  algorithm={circuitName}
                  inputData={uploadedData}
                  circuitInfo={{
                    qubits,
                    depth: circuitData?.depth || 0,
                    gates: circuitData?.gates || [],
                    qasm: circuitCode,
                  }}
                  executionResults={{
                    counts: results.counts || {},
                    shots: results.total_shots || shots,
                    success_rate: results.success_rate || 0,
                    runtime_ms: results.runtime_ms || 0,
                  }}
                  backendConfig={{
                    backend,
                    error_mitigation: errorMitigation,
                    transpiled: true,
                  }}
                  showDominantStates={showDominantStates}
                />
              )}
            </div>
          ) : null}

          {/* Section Toggles — only in manual mode */}
          {!sdkMode && dataUploaded && (circuitImageUrl || circuitCode) && (
            <Card className="p-4 shadow-lg bg-card">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Show / Hide Sections</h3>
              <div className="flex flex-wrap gap-3">
                {circuitImageUrl && (
                  <button
                    onClick={() => setShowVisualizer((v) => !v)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                      showVisualizer
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    Model Visualizer
                  </button>
                )}
                {circuitCode && (
                  <button
                    onClick={() => setShowCodeEditor((v) => !v)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                      showCodeEditor
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    Model Code
                  </button>
                )}
                {results && (
                  <button
                    onClick={() => setShowDominantStates((v) => !v)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                      showDominantStates
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    Dominant Quantum States
                  </button>
                )}
              </div>
            </Card>
          )}

          {/* Circuit Visualizer — manual mode only */}
          {!sdkMode && dataUploaded && circuitImageUrl && showVisualizer && (
            <Card className="p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Model Visualizer</h3>
                <Button
                  onClick={handleDownloadCircuitImage}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-2 bg-transparent"
                >
                  <Download size={16} />
                  Download
                </Button>
              </div>
              <div className="rounded-lg min-h-96 border border-border flex items-center justify-center bg-secondary overflow-hidden">
                <img
                  src={circuitImageUrl || "/placeholder.svg"}
                  alt="Generated Quantum Circuit"
                  className="w-full h-auto object-contain"
                />
              </div>
            </Card>
          )}

          {/* Circuit Code Editor — manual mode only */}
          {!sdkMode && dataUploaded && circuitCode && showCodeEditor && (
            <Card className="p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Model Code (OpenQASM)</h3>
                <div className="flex gap-2">
                  {isCodeEditable ? (
                    <Button onClick={handleSaveCode} size="sm" className="bg-primary">
                      Save
                    </Button>
                  ) : (
                    <Button onClick={() => setIsCodeEditable(true)} size="sm" variant="outline">
                      Edit
                    </Button>
                  )}
                  <Button
                    onClick={handleDownloadCircuitCode}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-2 bg-transparent"
                  >
                    <Download size={16} />
                    Download
                  </Button>
                </div>
              </div>
              {isCodeEditable ? (
                <textarea
                  value={circuitCode}
                  onChange={(e) => setCircuitCode(e.target.value)}
                  className="w-full p-4 rounded-lg text-sm font-mono bg-secondary text-secondary-foreground border border-border min-h-96"
                />
              ) : (
                <pre className="p-4 rounded-lg text-sm font-mono text-secondary-foreground bg-secondary max-h-96 overflow-auto">
                  {circuitCode
                    ? circuitCode.replace(/^OPENQASM\s+2\.0;\s*\n/i, "").replace(/^include\s+"qelib1\.inc";\s*\n/i, "")
                    : `// Upload data and select algorithm to generate circuit code`}
                </pre>
              )}
            </Card>
          )}
        </div>

        {/* Right column: pipeline settings — manual mode only */}
        {!sdkMode && (
        <div className="hidden lg:block space-y-6">
          {!isHidden('runner.database_uploader') && (
          <DatabaseUploader
            onDataUpload={handleDataUpload}
            preSelectedAlgorithm={selectedAlgorithm}
            onAlgorithmSelect={(algorithm) => {
              setCircuitName(algorithm)
            }}
          />
          )}
          {!isHidden('runner.autoparser') && (
          <AutoParser onParsed={handleAutoParse} inputData={uploadedData} algorithm={selectedAlgorithm ?? undefined} />
          )}
          {!isHidden('runner.circuit_settings') && (
          <div>
            {/* Advanced Quantum Settings collapsible wrapper */}
            <button
              onClick={() => setShowAdvancedQuantum((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-secondary/40 hover:bg-secondary/70 transition-colors text-sm font-semibold text-foreground mb-2"
            >
              <div className="flex items-center gap-2">
                <Settings2 size={15} className="text-muted-foreground" />
                Advanced Quantum Settings
              </div>
              <ChevronDown size={15} className={`text-muted-foreground transition-transform duration-200 ${showAdvancedQuantum ? "rotate-180" : ""}`} />
            </button>
            {showAdvancedQuantum && (
              <div className="space-y-4">
                <CircuitSettings
                  onExecutionTypeChange={setExecutionType}
                  onQubitsChange={setQubits}
                  onErrorMitigationChange={setErrorMitigation}
                />
                {!isHidden('runner.execution_settings') && (
                <ExecutionSettings
                  onBackendChange={setBackend}
                  currentBackend={backend}
                  onModeChange={setExecutionType}
                  qubits={qubits}
                  depth={circuitData?.depth || 20}
                  postRunReason={results?.backendReason ?? null}
                />
                )}
              </div>
            )}
          </div>
          )}
          {!isHidden('runner.autoparser') && (
          <ExpectedResults backend={backend} qubits={qubits} depth={circuitData?.depth || 20} hasData={dataUploaded} />
          )}
          {executionType === "manual" && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Shots</label>
              <input
                type="number"
                value={shots || 1024}
                onChange={(e) => setShots(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg"
                min={100}
                max={10000}
              />
            </div>
          )}
        </div>
        )} {/* end !sdkMode right column */}
      </div>

      {/* Run / Save / Reset — manual mode only */}
      {!sdkMode && (
      <div className="hidden lg:flex justify-center gap-3 pt-6 border-border border-t-2">
        <Button onClick={handleReset} variant="outline" className="flex items-center gap-2 bg-secondary">
          <RotateCcw size={18} />
          Reset
        </Button>
        <Button onClick={handleSaveCircuit} variant="outline" className="flex items-center gap-2 bg-secondary">
          <Save size={18} />
          Save
        </Button>
        <Button
          onClick={handleBatchRun}
          disabled={isRunning}
          className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {batchProgress ? `Run ${batchProgress.current}/${batchProgress.total}…` : "Simulating…"}
            </>
          ) : (
            <>
              <Play size={18} />
              {executionStrategy !== "single" ? `Simulate ${batchSize} runs` : "Simulate scenario"}
            </>
          )}
        </Button>
      </div>
      )} {/* end !sdkMode run buttons */}
    </div>
  )
}
