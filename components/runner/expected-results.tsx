"use client"

import { useState } from "react"
import { ChevronDown } from 'lucide-react'
import { Card } from "@/components/ui/card"

interface ExpectedResultsProps {
  backend: string
}

export function ExpectedResults({ backend }: ExpectedResultsProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  // Mock comparison data for all backends
  const backendComparison = {
    quantum_inspired_gpu: { name: "Quantum Inspired GPU", fidelity: 98.5, speed: "Fast", cost: "Low" },
    hpc_gpu: { name: "HPC GPU", fidelity: 99.2, speed: "Very Fast", cost: "Medium" },
    quantum_qpu: { name: "Quantum QPU", fidelity: 95.8, speed: "Medium", cost: "High" },
  }

  const expectedMetrics = {
    estimatedFidelity: backendComparison[backend as keyof typeof backendComparison]?.fidelity || 98.5,
    estimatedRuntime: Math.random() * 2 + 0.5,
    estimatedCost: "$" + (Math.random() * 0.5 + 0.1).toFixed(3),
    queuePosition: Math.floor(Math.random() * 5) + 1,
  }

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
              <p className="text-xl font-bold text-primary">{expectedMetrics.estimatedFidelity}%</p>
            </div>
            <div className="p-3 bg-secondary/50 rounded-lg border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Est. Runtime</p>
              <p className="text-xl font-bold text-primary">{expectedMetrics.estimatedRuntime.toFixed(2)}s</p>
            </div>
            <div className="p-3 bg-secondary/50 rounded-lg border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Est. Cost</p>
              <p className="text-xl font-bold text-primary">{expectedMetrics.estimatedCost}</p>
            </div>
            <div className="p-3 bg-secondary/50 rounded-lg border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Queue Position</p>
              <p className="text-xl font-bold text-primary">#{expectedMetrics.queuePosition}</p>
            </div>
          </div>

          {/* Backend Comparison */}
          <div className="mt-4">
            <p className="text-sm font-medium text-foreground mb-3">Backend Comparison</p>
            <div className="space-y-2">
              {Object.entries(backendComparison).map(([key, data]) => (
                <div
                  key={key}
                  className={`p-3 rounded-lg border transition ${
                    key === backend
                      ? "bg-primary/10 border-primary"
                      : "bg-secondary/30 border-border"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <p className="font-medium text-foreground text-sm">{data.name}</p>
                    {key === backend && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                        Selected
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span>Fidelity: {data.fidelity}%</span>
                    <span>Speed: {data.speed}</span>
                    <span>Cost: {data.cost}</span>
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
