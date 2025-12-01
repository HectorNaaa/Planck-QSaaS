"use client"

import { useState } from "react"
import { ChevronDown, Download } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface CircuitResultsProps {
  backend: string
  results?: any
  qubits: number
  onDownload?: () => void
}

export function CircuitResults({ backend, results, qubits, onDownload }: CircuitResultsProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  // Backend display names
  const backendNames = {
    quantum_inspired_gpu: "Quantum Inspired GPU",
    hpc_gpu: "HPC GPU",
    quantum_qpu: "Quantum QPU",
  }

  // Mock bitstring probabilities
  const bitstringProbs = [
    { bitstring: "0110001", probability: 0.342 },
    { bitstring: "1001110", probability: 0.218 },
    { bitstring: "0011101", probability: 0.156 },
    { bitstring: "1100010", probability: 0.124 },
    { bitstring: "0000000", probability: 0.089 },
    { bitstring: "1111111", probability: 0.071 },
  ]

  const benchmarks = results || {
    successRate: 96.4,
    runtime: 1.45,
    qubitsUsed: qubits,
    shots: 1024,
    fidelity: 98.2,
  }

  return (
    <Card className="p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <h2 className="text-2xl font-bold text-foreground">Circuit Results</h2>
          <ChevronDown
            size={24}
            className={`text-primary transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
          />
        </div>
        {onDownload && results && (
          <Button onClick={onDownload} size="sm" variant="outline" className="flex items-center gap-2 bg-transparent">
            <Download size={16} />
            Download
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {/* Backend Info */}
          <div className="p-3 bg-primary/10 rounded-lg border border-primary">
            <p className="text-sm font-medium text-foreground">
              Backend: {backendNames[backend as keyof typeof backendNames]}
            </p>
          </div>

          {/* Benchmarks */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-secondary/50 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">Success Rate</p>
              <p className="text-xl font-bold text-primary">{benchmarks.successRate}%</p>
            </div>
            <div className="p-3 bg-secondary/50 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">Runtime</p>
              <p className="text-xl font-bold text-primary">{benchmarks.runtime}s</p>
            </div>
            <div className="p-3 bg-secondary/50 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">Qubits Used</p>
              <p className="text-xl font-bold text-primary">{benchmarks.qubitsUsed}</p>
            </div>
            <div className="p-3 bg-secondary/50 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">Fidelity</p>
              <p className="text-xl font-bold text-primary">{benchmarks.fidelity}%</p>
            </div>
          </div>

          {/* Bitstring Probabilities */}
          <div className="mt-4">
            <p className="text-sm font-medium text-foreground mb-3">Measurement Probabilities</p>
            <div className="space-y-2 min-h-64 max-h-96 overflow-auto">
              {bitstringProbs.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 bg-secondary/30 rounded border border-border"
                >
                  <code className="text-sm font-mono text-foreground">{item.bitstring}</code>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-secondary rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{ width: `${item.probability * 100}%` }} />
                    </div>
                    <span className="text-sm font-medium text-primary w-12 text-right">
                      {(item.probability * 100).toFixed(1)}%
                    </span>
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
