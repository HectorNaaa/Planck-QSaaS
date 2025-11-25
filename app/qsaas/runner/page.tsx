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
import { Save, Play, RotateCcw } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/page-header"
import { generateQASM2, parseUploadedData, type CircuitData } from "@/lib/qasm-generator"
import { selectOptimalBackend } from "@/lib/backend-selector"

export default function RunnerPage() {
  const [isRunning, setIsRunning] = useState(false)
  const [circuitName, setCircuitName] = useState("Grover's Algorithm")
  const [executionType, setExecutionType] = useState<"auto" | "manual">("auto")
  const [backend, setBackend] = useState<"quantum_inspired_gpu" | "hpc_gpu" | "quantum_qpu">("quantum_inspired_gpu")
  const [shots, setShots] = useState(1024)
  const [qubits, setQubits] = useState(4)
  const [errorMitigation, setErrorMitigation] = useState<"none" | "low" | "medium" | "high">("none")
  const [results, setResults] = useState<any>(null)
  const [circuitCode, setCircuitCode] = useState("")
  const [circuitData, setCircuitData] = useState<CircuitData | null>(null)
  const [isCodeEditable, setIsCodeEditable] = useState(false)

  const handleDataUpload = useCallback(
    (uploadedData: any) => {
      const parsed = parseUploadedData(uploadedData)
      setCircuitData(parsed)
      const qasm = generateQASM2(parsed)
      setCircuitCode(qasm)

      if (executionType === "auto") {
        const optimal = selectOptimalBackend({
          qubits: parsed.qubits,
          depth: parsed.gates.length,
          gateCount: parsed.gates.length,
        })
        setBackend(optimal)
      }
    },
    [executionType],
  )

  const handleSaveCode = useCallback(() => {
    console.log("[v0] Saved circuit code:", circuitCode)
    setIsCodeEditable(false)
    // TODO: Store in localStorage or database
  }, [circuitCode])

  const handleRunCircuit = useCallback(async () => {
    setIsRunning(true)

    try {
      try {
        const supabase = createClient()
        await supabase.from("execution_logs").insert({
          circuit_name: circuitName,
          execution_type: executionType,
          backend,
          status: "running",
          qubits_used: qubits,
          shots,
          error_mitigation: errorMitigation,
        })
      } catch (logError) {
        console.error("[v0] Failed to log execution start to Supabase:", logError)
      }

      // Simulate quantum computation
      await new Promise((resolve) => setTimeout(resolve, 2500))

      // Mock results
      const mockResults = {
        success_rate: Math.random() * 0.1 + 0.9, // 90-100%
        runtime_ms: Math.random() * 500 + 100,
        qubits_used: qubits,
        total_shots: shots,
        backend,
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
  }, [circuitName, executionType, backend, shots, qubits, errorMitigation])

  return (
    <div className="p-8 space-y-6 px-4">
      <PageHeader title="Runner" description="Build and execute quantum circuits" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 shadow-lg">
            <h2 className="text-2xl font-bold text-foreground mb-4">Circuit Visualizer</h2>
            <div className="rounded-lg min-h-96 border border-border flex items-center justify-center bg-secondary overflow-hidden">
              <img
                src="/circuit-q4-example-planck.png"
                alt="Quantum Circuit with 4 Qubits"
                className="w-full h-auto object-contain"
              />
            </div>
          </Card>

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

          <CircuitResults backend={backend} results={results} qubits={qubits} />
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
            hasData={!!circuitData}
          />
        </div>
      </div>

      <div className="flex justify-center gap-3 pt-6 border-border border-t-2">
        <Button variant="outline" className="flex items-center gap-2 bg-secondary">
          <RotateCcw size={18} />
          Reset
        </Button>
        <Button variant="outline" className="flex items-center gap-2 bg-secondary">
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
