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
import { Save, Play, RotateCcw, Download, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/page-header"
import type { CircuitData } from "@/lib/qasm-generator"
import { selectOptimalBackend, calculateFidelity, estimateRuntime } from "@/lib/backend-selector"
import { DigitalTwinPanel } from "@/components/runner/digital-twin-panel"

export default function RunnerPage() {
  const [isRunning, setIsRunning] = useState(false)
  const [executionName, setExecutionName] = useState("")
  const [targetLatency, setTargetLatency] = useState<number | null>(null)
  const [circuitName, setCircuitName] = useState("")
  const [executionType, setExecutionType] = useState<"auto" | "manual">("auto")
  const [backend, setBackend] = useState<"quantum_inspired_gpu" | "hpc_gpu" | "quantum_qpu">("quantum_inspired_gpu")
  const [shots, setShots] = useState(1024)
  const [qubits, setQubits] = useState(4)
  const [errorMitigation, setErrorMitigation] = useState<"none" | "low" | "medium" | "high">("none")
  const [results, setResults] = useState<any>(null)
  const [circuitCode, setCircuitCode] = useState("")
  const [circuitData, setCircuitData] = useState<CircuitData | null>(null)
  const [isCodeEditable, setIsCodeEditable] = useState(false)
  const [dataUploaded, setDataUploaded] = useState(false)
  const [uploadedData, setUploadedData] = useState<any>(null)
  const [circuitImageUrl, setCircuitImageUrl] = useState<string | null>(null)
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<string | null>(null)

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
        setShots(state.shots || 1024)
        setQubits(state.qubits || 4)
        setErrorMitigation(state.errorMitigation || "none")
        setCircuitCode(state.circuitCode || "")
        setCircuitData(state.circuitData || null)
        setDataUploaded(state.dataUploaded || false)
        setUploadedData(state.uploadedData || null)
        setCircuitImageUrl(state.circuitImageUrl || null)
        setTargetLatency(state.targetLatency || null)
      } catch (err) {
        console.error("[v0] Error restoring state:", err)
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
      qubits,
      errorMitigation,
      circuitCode,
      circuitData,
      dataUploaded,
      uploadedData,
      circuitImageUrl,
      targetLatency,
    }
    sessionStorage.setItem("runner_state", JSON.stringify(state))
  }, [
    executionName,
    circuitName,
    executionType,
    backend,
    shots,
    qubits,
    errorMitigation,
    circuitCode,
    circuitData,
    dataUploaded,
    uploadedData,
    circuitImageUrl,
    targetLatency,
  ])

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
            shots,
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
        } else {
          console.error("[v0] Circuit generation failed:", data.error)
        }
      } catch (error) {
        console.error("[v0] Failed to generate circuit:", error)
        setDataUploaded(false)
      }
    },
    [circuitName, executionType, qubits, shots, errorMitigation, targetLatency],
  )

  const handleSaveCode = useCallback(() => {
    setIsCodeEditable(false)
  }, [circuitCode])

  const handleRunCircuit = useCallback(async () => {
    setIsRunning(true)

    try {
      const transpileResponse = await fetch("/api/quantum/transpile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qasm: circuitCode,
          backend,
          qubits,
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
          shots,
          backend,
          errorMitigation,
          circuitName: executionName || `${circuitName} Execution`,
          algorithm: circuitName,
          executionType,
          qubits,
          targetLatency,
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
            depth: circuitData?.gates.length || 0,
            gates: circuitData?.gates || [],
            qasm: circuitCode,
          },
          executionResults: {
            counts: simulateData.counts,
            shots,
            success_rate: simulateData.successRate,
            runtime_ms: simulateData.runtime,
            execution_id: simulateData.execution_id,
          },
          backendConfig: {
            backend,
            error_mitigation: errorMitigation,
            transpiled: true,
            noise_model: backend === "quantum_qpu" ? "realistic" : "ideal",
          },
        }),
      })

      const digitalTwinData = await digitalTwinResponse.json()

      if (digitalTwinData.success) {
        const mockResults = {
          success_rate: simulateData.successRate,
          runtime_ms: simulateData.runtime,
          qubits_used: qubits,
          total_shots: shots,
          backend,
          counts: simulateData.counts,
          digital_twin: digitalTwinData.digital_twin,
        }

        setResults(mockResults)
      } else {
        const mockResults = {
          success_rate: simulateData.successRate,
          runtime_ms: simulateData.runtime,
          qubits_used: qubits,
          total_shots: shots,
          backend,
          counts: simulateData.counts,
        }
        setResults(mockResults)
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsRunning(false)
    }
  }, [circuitCode, backend, qubits, shots, errorMitigation, executionName, circuitName, executionType, targetLatency])

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
    const resultsData = JSON.stringify(results, null, 2)
    const blob = new Blob([resultsData], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${circuitName.replace(/\s+/g, "_")}_results.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [results, circuitName])

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
        shots,
        error_mitigation: errorMitigation,
      },
      execution_settings: {
        backend,
        qubits,
        depth: circuitData?.gates.length || 0,
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
        user_id: user.id,
        circuit_name: executionName || `${circuitName} Execution`,
        algorithm: circuitName,
        execution_type: executionType,
        backend,
        status: "saved",
        qubits_used: qubits,
        shots,
        error_mitigation: errorMitigation,
        circuit_data: circuitSnapshot,
      })

      if (error) {
        console.error("[v0] Error saving circuit to Supabase:", error)
      } else {
        console.log("[v0] Circuit saved successfully with all backend results and complete QASM code")
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
    setShots(1024)
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
    sessionStorage.removeItem("runner_state")
    sessionStorage.removeItem("selectedAlgorithm")
  }, [])

  return (
    <div className="p-8 space-y-8 px-0">
      <PageHeader title="Runner" description="Configure and execute your quantum circuits" />

      <Card className="p-6 shadow-lg bg-secondary px-6">
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
            <p className="text-xs text-muted-foreground mt-1">
              Give this execution a custom name to easily identify it in your dashboard
            </p>
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
            <p className="text-xs text-muted-foreground mt-1">
              For Quantum QPU: Minimum 500ms required. If less than 500ms, execution will use HPC or Classical backend
            </p>
          </div>
        </div>
      </Card>

      <div className="lg:hidden space-y-6">
        <DatabaseUploader
          onDataUpload={handleDataUpload}
          preSelectedAlgorithm={selectedAlgorithm}
          onAlgorithmSelect={(algorithm) => {
            setCircuitName(algorithm)
          }}
        />
        <AutoParser inputData={uploadedData} algorithm={circuitName} />
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
          depth={circuitData?.gates.length || 20}
        />
        <ExpectedResults
          backend={backend}
          qubits={qubits}
          depth={circuitData?.gates.length || 20}
          hasData={dataUploaded}
        />

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {dataUploaded && circuitImageUrl ? (
            <Card className="p-6 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-foreground">Circuit Visualizer</h2>
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
          ) : (
            <Card className="p-6 shadow-lg bg-card px-4 py-4">
              <h2 className="text-2xl font-bold text-foreground mb-4">Circuit Visualizer</h2>
              <div className="rounded-lg min-h-96 border border-border border-dashed flex items-center justify-center bg-secondary/30">
                <p className="text-muted-foreground px-3 py-3">
                  Upload data and select an algorithm to generate circuit
                </p>
              </div>
            </Card>
          )}

          {dataUploaded && circuitCode ? (
            <Card className="p-6 shadow-lg bg-card">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-foreground">Circuit Code</h2>
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
          ) : (
            <Card className="p-6 shadow-lg bg-card px-4 py-4">
              <h2 className="text-2xl font-bold text-foreground mb-4">Circuit Code</h2>
              <div className="rounded-lg min-h-96 border border-border border-dashed flex items-center justify-center bg-secondary/30 px-0">
                <p className="text-muted-foreground px-3 py-3">Circuit code will appear here after generation</p>
              </div>
            </Card>
          )}

          {results ? (
            <div className="space-y-6">
              <CircuitResults backend={backend} results={results} qubits={qubits} onDownload={handleDownloadResults} />
              {results && uploadedData && circuitCode && (
                <DigitalTwinPanel
                  algorithm={circuitName}
                  inputData={uploadedData}
                  circuitInfo={{
                    qubits,
                    depth: circuitData?.gates.length || 0,
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
                />
              )}
            </div>
          ) : (
            <Card className="p-6 shadow-lg px-4 py-4">
              <h2 className="text-2xl font-bold text-foreground mb-4">Circuit Results</h2>
              <div className="rounded-lg min-h-96 border border-border border-dashed flex items-center justify-center bg-secondary/30">
                <p className="text-muted-foreground px-3 py-3">Results will appear here after execution</p>
              </div>
            </Card>
          )}
        </div>

        <div className="hidden lg:block space-y-6">
          <DatabaseUploader
            onDataUpload={handleDataUpload}
            preSelectedAlgorithm={selectedAlgorithm}
            onAlgorithmSelect={(algorithm) => {
              setCircuitName(algorithm)
            }}
          />
          <AutoParser inputData={uploadedData} algorithm={circuitName} />
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
            depth={circuitData?.gates.length || 20}
          />
          <ExpectedResults
            backend={backend}
            qubits={qubits}
            depth={circuitData?.gates.length || 20}
            hasData={dataUploaded}
          />
        </div>
      </div>

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
    </div>
  )
}
