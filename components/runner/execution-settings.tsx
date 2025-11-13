"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"

type ExecutionBackend = "quantum-gpu" | "hpc-gpu" | "qpu"

export function ExecutionSettings() {
  const [backend, setBackend] = useState<ExecutionBackend>("quantum-gpu")
  const [isExpanded, setIsExpanded] = useState(false)

  const backends = [
    {
      id: "quantum-gpu" as const,
      label: "Quantum Inspired GPU",
      description: "Classical GPU simulation with quantum-inspired algorithms",
      icon: "🚀",
    },
    {
      id: "hpc-gpu" as const,
      label: "HPC GPU",
      description: "High-performance computing GPU for large-scale simulations",
      icon: "⚡",
    },
    {
      id: "qpu" as const,
      label: "Quantum QPU",
      description: "Real quantum processor execution (limited availability)",
      icon: "🔬",
    },
  ]

  return (
    <Card className="p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-foreground">Execution Settings</h3>
        <button onClick={() => setIsExpanded(!isExpanded)} className="text-primary hover:text-primary/80 transition">
          {isExpanded ? "−" : "+"}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-3">
          {backends.map((b) => (
            <button
              key={b.id}
              onClick={() => setBackend(b.id)}
              className={`w-full text-left p-4 rounded-lg transition border-2 ${
                backend === b.id
                  ? "border-primary bg-primary/10"
                  : "border-secondary bg-secondary/30 hover:border-primary/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{b.icon}</span>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{b.label}</p>
                  <p className="text-xs text-muted-foreground">{b.description}</p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    backend === b.id ? "border-primary bg-primary" : "border-muted-foreground"
                  }`}
                >
                  {backend === b.id && <div className="w-2 h-2 bg-primary-foreground rounded-full" />}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}
