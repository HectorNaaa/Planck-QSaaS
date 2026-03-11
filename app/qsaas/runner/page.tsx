"use client"

import { useState, useCallback, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CircuitSettings } from "@/components/runner/circuit-settings"
import { ExecutionSettings } from "@/components/runner/execution-settings"
import { DatabaseUploader } from "@/components/runner/database-uploader"
import { AutoParser } from "@/components/runner/autoparser"
import { ExpectedResults } from "@/components/runner/expected-results"
import { CircuitResults } from "@/components/runner/circuit-results"
import { Save, Play, RotateCcw, Download, Loader2, Radio, Wifi, WifiOff } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/page-header"
import type { BuiltCircuit } from "@/lib/circuit-builder"

// CircuitData extends BuiltCircuit with a gates array for backwards-compat
// (BuiltCircuit stores only gateCount; CircuitData keeps the full gate list)
type CircuitData = BuiltCircuit & { gates: string[] }
import { selectOptimalBackend, calculateFidelity, estimateRuntime } from "@/lib/backend-selector"
import { DigitalTwinPanel } from "@/components/runner/digital-twin-panel"
import { DigitalTwinSelector } from "@/components/runner/digital-twin-selector"
import { DigitalTwinDashboard } from "@/components/dashboard/digital-twin-dashboard"
import { useLiveExecutions } from "@/hooks/use-live-executions"

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
  const [sdkMode, setSdkMode] = useState(false)
  // User API key — needed for browser EventSource auth (can't send custom headers)
  const [userApiKey, setUserApiKey] = useState<string | null>(null)

  // Fetch API key once on mount
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user.id) return
      supabase
        .from("profiles")
        .select("api_key")
        .eq("id", session.user.id)
        .single()
        .then(({ data }) => { if (data?.api_key) setUserApiKey(data.api_key) })
    })
  }, [])

  // Live SSE feed — active only when SDK mode is on
  const { rows: liveRows, connected: liveConnected } = useLiveExecutions({
    enabled: sdkMode,
    digitalTwinId: selectedDigitalTwinId,
    apiKey: userApiKey,
  })

  // When a new live row arrives, update results + circuit display from the latest job
  useEffect(() => {
    if (!sdkMode || liveRows.length === 0) return
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
      const base = 512
      const qubitBonus = Math.floor(circuitParams.qubits / 5) * 256
      const depthBonus  = Math.floor(circuitParams.depth   / 20) * 128
      const gateBonus   = Math.floor(circuitParams.gates   / 30) * 64
      return Math.min(8192, Math.max(512, base + qubitBonus + depthBonus + gateBonus))
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
              targetLatency,
            })
            setBackend(optimal)
          }

          const adaptiveShots = calculateAdaptiveShots({
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
    setIsRunning(true)

    try {
      const transpileResponse = await fetch("/api/quantum/transpile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qasm: circuitCode,
          backend,
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
          backend,
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
        backend: simulateData.backend || backend,
        counts: simulateData.counts,
        error_mitigation: simulateData.error_mitigation || errorMitigation,
        error_mitigation_requested: simulateData.error_mitigation_requested || errorMitigation,
        ml_tuning: simulateData.ml_tuning || null,
        ...(digitalTwinData.success ? { digital_twin: digitalTwinData.digital_twin } : {}),
      }

      setResults(baseResults)
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

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        console.error("[v0] Cannot save circuit: User not authenticated")
        return
      }

      const { error } = await supabase.from("execution_logs").insert({
        name: executionName || null,
        algorithm: circuitName,
        execution_type: executionType,
        backend,
        status: "saved",
        qubits_used: qubits,
        shots: executionType === "auto" ? (autoShots || calculateAdaptiveShots({ qubits, depth: circuitData?.depth || 10, gates: circuitData?.gates.length || 20 })) : (shots || 1024),
        error_mitigation: errorMitigation,
        circuit_data: circuitSnapshot,
        digital_twin_id: selectedDigitalTwinId,
      })

      if (error) {
        console.error("[v0] Error saving circuit to Supabase:", error)
      }
    } catch (error) {
      console.error("[v0] Error saving circuit to Supabase:", error)
    }
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
    sessionStorage.removeItem("runner_state")
    sessionStorage.removeItem("selectedAlgorithm")
  }, [])

  return (
    <div className="p-8 space-y-8 px-0">
      <PageHeader title="Runner" description="Configure and execute your quantum circuits" />

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
                ? "Results update automatically every 3 s from SDK jobs. Upload and editing are disabled."
                : "Enable to receive live results from notebook/script SDK calls."}
            </p>
          </div>
        </div>
        <button
          role="switch"
          aria-checked={sdkMode}
          onClick={() => {
            const next = !sdkMode
            setSdkMode(next)
            sessionStorage.setItem("planck_sdk_mode", next ? "1" : "0")
          }}
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
        <DatabaseUploader
          onDataUpload={handleDataUpload}
          preSelectedAlgorithm={selectedAlgorithm}
          onAlgorithmSelect={(algorithm) => {
            setCircuitName(algorithm)
          }}
        />
        <AutoParser onParsed={handleAutoParse} inputData={uploadedData} algorithm={selectedAlgorithm} />
        <CircuitSettings
          onExecutionTypeChange={setExecutionType}
          onQubitsChange={setQubits}
          onErrorMitigationChange={setErrorMitigation}
        />
        <ExecutionSettings
          onBackendChange={setBackend}
          currentBackend={backend}
          onModeChange={setExecutionType}
          qubits={qubits}
          depth={circuitData?.depth || 20}
        />
        <ExpectedResults backend={backend} qubits={qubits} depth={circuitData?.depth || 20} hasData={dataUploaded} />

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
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500 text-white font-bold">
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
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500 text-white font-bold">
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
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${results ? 'bg-green-500' : 'bg-gray-300'} text-white font-bold`}>
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
                              <span className="ml-1 text-green-400">(RL — {Math.round(mlRecommendation.confidence * 100)}% confidence)</span>
                            </p>
                            <p>
                              <span className="text-foreground font-medium">Mitigation: </span>
                              <span className="capitalize">{mlRecommendation.errorMitigation}</span>
                              <span className="ml-1 text-green-400">(auto)</span>
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
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${results ? 'bg-green-500' : 'bg-gray-300'} text-white font-bold`}>
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

          {/* Results — always shown in SDK mode; shown after a manual run otherwise */}
          {(results || sdkMode) ? (
            <div className="space-y-6">
              <CircuitResults backend={backend} results={results} qubits={qubits} onDownload={handleDownloadResults} isLive={sdkMode} />

              {/* Digital Twin Dashboard — shown in SDK mode so it updates live alongside CircuitResults */}
              {sdkMode && (
                <DigitalTwinDashboard
                  liveEnabled={true}
                  apiKey={userApiKey}
                  digitalTwinId={selectedDigitalTwinId}
                  title={selectedDigitalTwinId ? "Selected Digital Twin" : "All Digital Twins"}
                />
              )}

              {results && uploadedData && circuitCode && (
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
          <DatabaseUploader
            onDataUpload={handleDataUpload}
            preSelectedAlgorithm={selectedAlgorithm}
            onAlgorithmSelect={(algorithm) => {
              setCircuitName(algorithm)
            }}
          />
          <AutoParser onParsed={handleAutoParse} inputData={uploadedData} algorithm={selectedAlgorithm} />
          <CircuitSettings
            onExecutionTypeChange={setExecutionType}
            onQubitsChange={setQubits}
            onErrorMitigationChange={setErrorMitigation}
          />
          <ExecutionSettings
            onBackendChange={setBackend}
            currentBackend={backend}
            onModeChange={setExecutionType}
            qubits={qubits}
            depth={circuitData?.depth || 20}
          />
          <ExpectedResults backend={backend} qubits={qubits} depth={circuitData?.depth || 20} hasData={dataUploaded} />
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
