"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"

interface ExecutionResult {
  id: string
  timestamp: string
  backend: string
  successRate: number
  runtime: number
  qubitsUsed: number
}

const mockResults: ExecutionResult[] = [
  {
    id: "1",
    timestamp: "2024-11-12 14:32",
    backend: "Quantum GPU",
    successRate: 94.2,
    runtime: 1.23,
    qubitsUsed: 4,
  },
  {
    id: "2",
    timestamp: "2024-11-12 14:25",
    backend: "HPC GPU",
    successRate: 97.1,
    runtime: 0.85,
    qubitsUsed: 4,
  },
  {
    id: "3",
    timestamp: "2024-11-12 14:18",
    backend: "Quantum GPU",
    successRate: 92.8,
    runtime: 1.15,
    qubitsUsed: 4,
  },
]

export function ResultsPanel() {
  const [expandedResult, setExpandedResult] = useState<string | null>(null)

  const aggregatedStats = mockResults.reduce(
    (acc, result) => ({
      totalExecutions: acc.totalExecutions + 1,
      avgSuccessRate: acc.avgSuccessRate + result.successRate,
      avgRuntime: acc.avgRuntime + result.runtime,
      totalQubits: acc.totalQubits + result.qubitsUsed,
    }),
    { totalExecutions: 0, avgSuccessRate: 0, avgRuntime: 0, totalQubits: 0 },
  )

  aggregatedStats.avgSuccessRate = aggregatedStats.avgSuccessRate / aggregatedStats.totalExecutions
  aggregatedStats.avgRuntime = aggregatedStats.avgRuntime / aggregatedStats.totalExecutions

  return (
    <Card className="p-6 shadow-lg">
      <h3 className="text-lg font-bold text-foreground mb-4">Execution Results</h3>

      {/* Aggregated Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="p-4 bg-secondary/50 rounded-lg border border-primary/20">
          <p className="text-xs text-muted-foreground mb-1">Success Rate (Avg)</p>
          <p className="text-2xl font-bold text-primary">{aggregatedStats.avgSuccessRate.toFixed(1)}%</p>
        </div>
        <div className="p-4 bg-secondary/50 rounded-lg border border-primary/20">
          <p className="text-xs text-muted-foreground mb-1">Avg Runtime</p>
          <p className="text-2xl font-bold text-primary">{aggregatedStats.avgRuntime.toFixed(2)}s</p>
        </div>
        <div className="p-4 bg-secondary/50 rounded-lg border border-primary/20">
          <p className="text-xs text-muted-foreground mb-1">Total Qubits (Sum)</p>
          <p className="text-2xl font-bold text-primary">{aggregatedStats.totalQubits}</p>
        </div>
      </div>

      {/* Results History */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground mb-3">Recent Executions</p>
        {mockResults.map((result) => (
          <div
            key={result.id}
            onClick={() => setExpandedResult(expandedResult === result.id ? null : result.id)}
            className="p-4 bg-secondary/30 rounded-lg border border-border hover:border-primary/50 transition cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium text-foreground">{result.backend}</p>
                <p className="text-xs text-muted-foreground">{result.timestamp}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary">{result.successRate}%</p>
                <p className="text-xs text-muted-foreground">{result.runtime}s</p>
              </div>
            </div>

            {expandedResult === result.id && (
              <div className="mt-3 pt-3 border-t border-border text-sm text-muted-foreground space-y-1">
                <p>Qubits Used: {result.qubitsUsed}</p>
                <p>Success Rate: {result.successRate}%</p>
                <p>Runtime: {result.runtime}s</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}
