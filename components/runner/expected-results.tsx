"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Card } from "@/components/ui/card"
import { calculateFidelity, estimateRuntime } from "@/lib/backend-selector"

interface ExpectedResultsProps {
  backend: string
  qubits: number
  depth: number
  hasData?: boolean
}

export function ExpectedResults({ backend, qubits, depth, hasData = false }: ExpectedResultsProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const hilbertSpaceDim = Math.pow(2, qubits)
  const classicalOps = Math.pow(2, qubits) * depth
  const quantumOps = Math.sqrt(Math.pow(2, qubits)) * depth
  const classicalRuntime = estimateRuntime(Math.pow(2, qubits), false)
  const quantumRuntime = estimateRuntime(Math.pow(2, qubits), true)

  const backendComparison = {
    quantum_inspired_gpu: {
      name: "Quantum Inspired GPU",
      fidelity: calculateFidelity("quantum_inspired_gpu", qubits, depth),
      runtime: quantumRuntime,
    },
    hpc_gpu: {
      name: "HPC GPU",
      fidelity: calculateFidelity("hpc_gpu", qubits, depth),
      runtime: quantumRuntime * 0.7,
    },
    quantum_qpu: {
      name: "Quantum QPU",
      fidelity: calculateFidelity("quantum_qpu", qubits, depth),
      runtime: quantumRuntime * 1.2,
    },
  }

  const selectedBackend = backendComparison[backend as keyof typeof backendComparison]

  return (
    <Card className="p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <h3 className="text-lg font-bold text-foreground">Expected Results</h3>
        <ChevronDown
          size={24}
          className={`text-primary transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
        />
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {/* Expected Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-secondary/50 rounded-lg border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Est. Fidelity</p>
              <p className="text-xl font-bold text-primary">{selectedBackend.fidelity.toFixed(1)}%</p>
            </div>
          </div>

          {/* Complexity Analysis */}
          {hasData && (
            <div className="p-3 bg-secondary/50 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-2">Estimated Algorithmic Analysis</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground">Time (Classical):</span>
                  <span className="text-sm font-bold text-muted-foreground">{classicalOps.toLocaleString()} ops</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground">Time (Quantum):</span>
                  <span className="text-sm font-bold text-primary">{quantumOps.toLocaleString()} ops</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-sm text-foreground">Space (Hilbert):</span>
                  <span className="text-sm font-bold text-primary">{hilbertSpaceDim.toLocaleString()} dims</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground">Runtime Est.:</span>
                  <span className="text-sm font-bold text-primary">{selectedBackend.runtime.toFixed(3)}s</span>
                </div>
              </div>
            </div>
          )}

          {/* Backend Comparison */}
          <div className="mt-4">
            <p className="text-sm font-medium text-foreground mb-3">Backend Comparison</p>
            <div className="space-y-2">
              {Object.entries(backendComparison).map(([key, data]) => (
                <div
                  key={key}
                  className={`p-3 rounded-lg border transition ${
                    key === backend ? "bg-primary/10 border-primary" : "bg-secondary/30 border-border"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <p className="font-medium text-foreground text-sm">{data.name}</p>
                    {key === backend && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">Selected</span>
                    )}
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span>Fidelity: {data.fidelity.toFixed(1)}%</span>
                    <span>Runtime: {data.runtime.toFixed(3)}s</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
