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
import { Save, Play, RotateCcw, Zap } from 'lucide-react'
import { logExecution } from "@/lib/logging"

export default function RunnerPage() {
  const [isRunning, setIsRunning] = useState(false)
  const [circuitName, setCircuitName] = useState("Grover's Algorithm")
  const [executionType, setExecutionType] = useState<"auto" | "manual">("auto")
  const [backend, setBackend] = useState<"quantum_inspired_gpu" | "hpc_gpu" | "quantum_qpu">("quantum_inspired_gpu")
  const [shots, setShots] = useState(1024)
  const [qubits, setQubits] = useState(4)
  const [errorMitigation, setErrorMitigation] = useState<"none" | "low" | "medium" | "high">("none")
  const [results, setResults] = useState<any>(null)

  const handleRunCircuit = useCallback(async () => {
    setIsRunning(true)

    try {
      try {
        await logExecution({
          circuit_name: circuitName,
          execution_type: executionType,
          backend,
          status: "running",
          qubits_used: qubits,
          shots,
          error_mitigation: errorMitigation,
        })
      } catch (logError) {
        console.error("[v0] Failed to log execution start:", logError)
      }

      // Simulate quantum computation
      await new Promise((resolve) => setTimeout(resolve, 2500))

      // Mock results
      const mockResults = {
        success_rate: Math.random() * 0.3 + 0.7, // 70-100%
        runtime_ms: Math.random() * 500 + 100,
        qubits_used: qubits,
        total_shots: shots,
        backend,
      }

      setResults(mockResults)

      // Log execution completion
      try {
        await logExecution({
          circuit_name: circuitName,
          execution_type: executionType,
          backend,
          status: "completed",
          success_rate: mockResults.success_rate,
          runtime_ms: mockResults.runtime_ms,
          qubits_used: mockResults.qubits_used,
          shots,
          error_mitigation: errorMitigation,
        })
      } catch (logError) {
        console.error("[v0] Failed to log execution completion:", logError)
      }
    } catch (error) {
      console.error("[v0] Execution error:", error)

      // Log failure
      try {
        await logExecution({
          circuit_name: circuitName,
          execution_type: executionType,
          backend,
          status: "failed",
          qubits_used: qubits,
          shots,
          error_mitigation: errorMitigation,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      } catch (logError) {
        console.error("[v0] Failed to log execution failure:", logError)
      }
    } finally {
      setIsRunning(false)
    }
  }, [circuitName, executionType, backend, shots, qubits, errorMitigation])

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold mb-2 text-foreground">Quantum Runner</h1>
          <p className="text-muted-foreground">Build and execute quantum circuits in real-time.</p>
        </div>
        <div className="flex gap-3">
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
                Run Circuit
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Circuit Editor */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 shadow-lg">
            <h2 className="text-2xl font-bold text-foreground mb-4">Circuit Visualizer</h2>
            <div className="rounded-lg p-8 min-h-96 border border-border flex items-center justify-center bg-secondary">
              <div className="text-center">
                <Zap className="text-muted-foreground mx-auto mb-4" size={48} />
                <p className="text-muted-foreground">Quantum circuit visualization appears here</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 shadow-lg bg-card">
            <h2 className="text-2xl font-bold text-foreground mb-4">Circuit Code</h2>
            <pre className="p-4 rounded-lg text-sm font-mono text-secondary-foreground bg-secondary max-h-96 overflow-auto">
              {`// Grover's Algorithm Example with 4q
circuit = QuantumCircuit(4)

# Initialize to superposition
for i in range(4):
    circuit.h(i)

# Apply oracle
circuit.cx(0, 3)
circuit.cx(1, 3)
circuit.cx(2, 3)
circuit.cx(3, 3)
circuit.cx(0, 2)
circuit.cx(1, 2)
circuit.cx(2, 2)
circuit.cx(3, 2)

# Grover diffusion
for i in range(4):
    circuit.h(i)
for i in range(4):
    circuit.x(i)
circuit.h(3)
# ... diffusion continues`}
            </pre>
          </Card>

          {/* CircuitResults moved below Circuit Code */}
          <CircuitResults backend={backend} results={results} />
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          <DatabaseUploader />
          <AutoParser />
          <CircuitSettings
            onExecutionTypeChange={setExecutionType}
            onQubitsChange={setQubits}
            onErrorMitigationChange={setErrorMitigation}
          />
          <ExecutionSettings 
            onBackendChange={setBackend} 
            currentBackend={backend}
            onModeChange={(mode) => console.log("[v0] Execution mode changed to:", mode)}
          />
          {/* ExpectedResults replaced ResultsPanel */}
          <ExpectedResults backend={backend} />
        </div>
      </div>
    </div>
  )
}
