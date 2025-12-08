"use client"

import { useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CircuitSettings } from "@/components/runner/circuit-settings"
import { ExecutionSettings } from "@/components/runner/execution-settings"
import { DatabaseUploader } from "@/components/runner/database-uploader"
import { AutoParser } from "@/components/runner/autoparser"
import { ExpectedResults } from "@/components/runner/expected-results"
import { CircuitResults } from "@/components/runner/circuit-results"
import { LoadingSpinner } from "@/components/loading-spinner"
import { Save, Play, RotateCcw, Download } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/page-header"
import type { CircuitData } from "@/lib/qasm-generator"
import { selectOptimalBackend, calculateFidelity, estimateRuntime } from "@/lib/backend-selector"

export default function RunnerPage() {
  const [isRunning, setIsRunning] = useState(false)
  const [circuitName, setCircuitName] = useState("Grover") // Updated default circuit name to short version
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

  const handleDataUpload = useCallback(
    async (uploadedData: any) => {
      try {
        const response = await fetch("/api/quantum/generate-circuit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            algorithm: circuitName,
            inputData: uploadedData,
            qubits: uploadedData.qubits || qubits,
            shots,
            errorMitigation,
          }),
        })

        const data = await response.json()

        if (data.success) {
          setCircuitCode(data.qasm)
          setCircuitData({
            qubits: data.qubits,
            gates: data.gates,
          })
          setQubits(data.qubits)
          setDataUploaded(true)

          if (executionType === "auto") {
            const optimal = selectOptimalBackend({
              qubits: data.qubits,
              depth: data.depth,
              gateCount: data.gates.length,
            })
            setBackend(optimal)
          }
        }
      } catch (error) {
        console.error("[v0] Failed to generate circuit:", error)
      }
    },
    [circuitName, executionType, qubits, shots, errorMitigation],
  )

  const handleSaveCode = useCallback(() => {
    console.log("[v0] Saved circuit code:", circuitCode)
    setIsCodeEditable(false)
    // TODO: Store in localStorage or database
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

      console.log("[v0] Circuit transpiled, SWAP gates added:", transpileData.swapCount)

      const simulateResponse = await fetch("/api/quantum/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qasm: transpileData.transpiledQASM,
          shots,
          backend,
          errorMitigation,
        }),
      })

      const simulateData = await simulateResponse.json()

      if (simulateData.success) {
        const mockResults = {
          success_rate: simulateData.successRate,
          runtime_ms: simulateData.runtime,
          qubits_used: qubits,
          total_shots: shots,
          backend,
          counts: simulateData.counts,
        }

        setResults(mockResults)

        try {
          const supabase = createClient()
          await supabase.from("execution_logs").insert({
            circuit_name: circuitName,
            execution_type: executionType,
            backend,
            status: "completed",
            success_rate: mockResults.success_rate,
            runtime_ms: mockResults.runtime_ms,
            qubits_used: mockResults.qubits_used,
            shots,
            error_mitigation: errorMitigation,
            completed_at: new Date().toISOString(),
          })
        } catch (logError) {
          console.error("[v0] Failed to log execution completion to Supabase:", logError)
        }
      }
    } catch (error) {
      console.error("[v0] Execution error:", error)

      try {
        const supabase = createClient()
        await supabase.from("execution_logs").insert({
          circuit_name: circuitName,
          execution_type: executionType,
          backend,
          status: "failed",
          qubits_used: qubits,
          shots,
          error_mitigation: errorMitigation,
        })
      } catch (logError) {
        console.error("[v0] Failed to log execution failure to Supabase:", logError)
      }
    } finally {
      setIsRunning(false)
    }
  }, [circuitName, executionType, backend, shots, qubits, errorMitigation, circuitCode])

  const handleDownloadCircuitImage = useCallback(() => {
    const link = document.createElement("a")
    link.href = "/circuit-q4-example-planck.png"
    link.download = `${circuitName.replace(/\s+/g, "_")}_circuit.jpg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [circuitName])

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
      circuit_name: circuitName,
      execution_type: executionType,
      selected_backend: backend,
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
    }

    const blob = new Blob([JSON.stringify(circuitSnapshot, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${circuitName.replace(/\s+/g, "_")}_${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    try {
      const supabase = createClient()
      await supabase.from("execution_logs").insert({
        circuit_name: circuitName,
        execution_type: executionType,
        backend,
        status: "saved",
        qubits_used: qubits,
        shots,
        error_mitigation: errorMitigation,
        circuit_data: circuitSnapshot,
      })
      console.log("[v0] Circuit saved successfully with all backend results and complete QASM code")
    } catch (error) {
      console.error("[v0] Error saving circuit to Supabase:", error)
    }
  }, [circuitName, executionType, backend, shots, qubits, errorMitigation, circuitCode, circuitData, results])

  return (
    <div className="p-8 space-y-6 px-0">
      <PageHeader title="Runner" description="Build and execute quantum circuits" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {dataUploaded && (
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
                  src="/circuit-q4-example-planck.png"
                  alt="Quantum Circuit with 4 Qubits"
                  className="w-full h-auto object-contain"
                />
              </div>
            </Card>
          )}

          {dataUploaded && (
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
                  {circuitCode ||
                    `OPENQASM 2.0;
include "qelib1.inc";

qreg q[4];
creg c[4];

// Initialize to superposition
h q[0];
h q[1];
h q[2];
h q[3];

// Apply oracle
cx q[0],q[3];
cx q[1],q[2];

// Measure
measure q[0] -> c[0];
measure q[1] -> c[1];
measure q[2] -> c[2];
measure q[3] -> c[3];`}
                </pre>
              )}
            </Card>
          )}

          <CircuitResults backend={backend} results={results} qubits={qubits} onDownload={handleDownloadResults} />
        </div>

        <div className="space-y-6">
          <DatabaseUploader onDataUpload={handleDataUpload} />
          <AutoParser />
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

      <div className="flex justify-center gap-3 pt-6 border-border border-t-2">
        <Button variant="outline" className="flex items-center gap-2 bg-secondary">
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
              <LoadingSpinner size="sm" />
              Running...
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
