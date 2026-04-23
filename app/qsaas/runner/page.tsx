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
import { Save, Play, RotateCcw, Download, Loader2, Radio, Wifi, WifiOff, Trash2, Brain, FlaskConical } from "lucide-react"
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
  const isGuest = useIsGuest()
  const { isHidden } = useUIPreferences()
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
          // In auto mode, send "auto" so the server policy engine selects the backend
          // (sending a specific backend name is treated as a manual override and bypasses orchestration)
          backend: executionType === "auto" ? "auto" : backend,
          errorMitigation,
          circuitName: executionName || `${circuitName} Execution`,
          algorithm: circuitName,
          executionType,
          qubits,
          targetLatency,
          inputData: uploadedData,
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
    clearLiveRows()
    sessionStorage.removeItem("runner_state")
    sessionStorage.removeItem("selectedAlgorithm")
  }, [clearLiveRows])

  const handleClearResults = useCallback(() => {
    setResults(null)
    clearLiveRows()
    setInitialLiveRows([])
    setDtHistoryRows([])
    setClearKey((k) => k + 1)
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem("runner_results_cleared", "1")
  }, [clearLiveRows])

  return (
    <div className="p-8 space-y-8 px-0">
      <PageHeader title="Runner" description="Configure and execute your quantum circuits" />

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
              Execution Name (Optional)
            </label>
            <input
              id="execution-name"
              type="text"
              value={executionName}
              onChange={(e) => setExecutionName(e.target.value)}
              placeholder={`e.g., "My ${circuitName} Experiment"`}
              className="w-full px-4 py-2 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">Optional label for this execution</p>
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
        <CircuitSettings
          onExecutionTypeChange={setExecutionType}
          onQubitsChange={setQubits}
          onErrorMitigationChange={setErrorMitigation}
        />
        )}
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
            onClick={handleRunCircuit}
            disabled={isRunning}
            className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Running
              </>
            ) : (
              <>
                <Play size={18} />
                Run
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
            <h2 className="text-2xl font-bold text-foreground mb-4">Execution Pipeline</h2>
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
                      {circuitName} algorithm with {qubits} qubits
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full text-white font-bold" style={{ backgroundColor: "#7ab5ac" }}>
                    2
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">Circuit Generated</h3>
                    <p className="text-sm text-muted-foreground">
                      {circuitData?.gates.length || 0} gates, depth {circuitData?.depth || 0}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full text-white font-bold" style={{ backgroundColor: results ? '#7ab5ac' : '#d1d5db' }}>
                    3
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">Circuit Execution</h3>
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
                      <p className="text-sm text-muted-foreground">Ready to run</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full text-white font-bold" style={{ backgroundColor: results ? '#7ab5ac' : '#d1d5db' }}>
                    4
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">Results Generated</h3>
                    <p className="text-sm text-muted-foreground">
                      {results ? `Success rate: ${results.success_rate.toFixed(2)}%` : 'Waiting for execution'}
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
                title={selectedDigitalTwinId ? "Selected Digital Twin" : "Runs — All Digital Twins"}
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
                    Circuit Visualizer
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
                    Code Editor
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
                <h3 className="text-lg font-semibold text-foreground">Circuit Visualizer</h3>
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
                <h3 className="text-lg font-semibold text-foreground">Circuit Code Editor</h3>
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
          <CircuitSettings
            onExecutionTypeChange={setExecutionType}
            onQubitsChange={setQubits}
            onErrorMitigationChange={setErrorMitigation}
          />
          )}
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
          onClick={handleRunCircuit}
          disabled={isRunning}
          className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Running
            </>
          ) : (
            <>
              <Play size={18} />
              Run
            </>
          )}
        </Button>
      </div>
      )} {/* end !sdkMode run buttons */}
    </div>
  )
}
