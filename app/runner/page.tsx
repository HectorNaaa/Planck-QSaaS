"use client"

import { useState } from "react"
import { MainLayout } from "@/components/layout/main-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CircuitSettings } from "@/components/runner/circuit-settings"
import { ExecutionSettings } from "@/components/runner/execution-settings"
import { DatabaseUploader } from "@/components/runner/database-uploader"
import { AutoParser } from "@/components/runner/autoparser"
import { ResultsPanel } from "@/components/runner/results-panel"
import { Save, Play, RotateCcw, Zap } from "lucide-react"

export default function RunnerPage() {
  const [isRunning, setIsRunning] = useState(false)

  const handleRunCircuit = () => {
    setIsRunning(true)
    setTimeout(() => setIsRunning(false), 2000)
  }

  return (
    <MainLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Quantum Runner</h1>
            <p className="text-muted-foreground">Build and execute quantum circuits in real-time.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex items-center gap-2 bg-transparent">
              <RotateCcw size={18} />
              Reset
            </Button>
            <Button variant="outline" className="flex items-center gap-2 bg-transparent">
              <Save size={18} />
              Save
            </Button>
            <Button
              onClick={handleRunCircuit}
              disabled={isRunning}
              className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2"
            >
              <Play size={18} />
              {isRunning ? "Running..." : "Run Circuit"}
            </Button>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Circuit Editor */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <h2 className="text-2xl font-bold text-foreground mb-4">Circuit Builder</h2>
              <div className="bg-secondary/50 rounded-lg p-8 min-h-96 border border-border flex items-center justify-center">
                <div className="text-center">
                  <Zap className="text-muted-foreground mx-auto mb-4" size={48} />
                  <p className="text-muted-foreground">Quantum circuit visualization appears here</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-2xl font-bold text-foreground mb-4">Quantum Code</h2>
              <pre className="bg-secondary/50 p-4 rounded-lg text-sm text-muted-foreground overflow-x-auto font-mono">
                {`// Grover's Algorithm Example
circuit = QuantumCircuit(4)

# Initialize to superposition
for i in range(4):
    circuit.h(i)

# Apply oracle
circuit.cx(0, 3)
circuit.cx(1, 3)

# Grover diffusion
for i in range(4):
    circuit.h(i)
for i in range(4):
    circuit.x(i)
circuit.h(3)
# ... diffusion continues`}
              </pre>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            <DatabaseUploader />
            <AutoParser />
            <CircuitSettings />
            <ExecutionSettings />
            <ResultsPanel />
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
