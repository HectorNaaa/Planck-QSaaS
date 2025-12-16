"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Card } from "@/components/ui/card"

type ExecutionBackend = "quantum_inspired_gpu" | "hpc_gpu" | "quantum_qpu"

interface ExecutionSettingsProps {
  onBackendChange?: (backend: ExecutionBackend) => void
  currentBackend?: ExecutionBackend
  onModeChange?: (mode: "auto" | "manual") => void
  qubits: number
  depth: number
}

export function ExecutionSettings({
  onBackendChange,
  currentBackend,
  onModeChange,
  qubits,
  depth,
}: ExecutionSettingsProps) {
  const [backend, setBackend] = useState<ExecutionBackend>(currentBackend || "quantum_inspired_gpu")
  const [isExpanded, setIsExpanded] = useState(false)
  const [mode, setMode] = useState<"auto" | "manual">("auto")

  const handleBackendChange = (newBackend: ExecutionBackend) => {
    setBackend(newBackend)
    onBackendChange?.(newBackend)
  }

  const handleModeChange = (newMode: "auto" | "manual") => {
    setMode(newMode)
    onModeChange?.(newMode)
  }

  const backends = [
    {
      id: "quantum_inspired_gpu" as const,
      label: "Quantum Inspired GPU",
      description: "Classical GPU simulation with quantum-inspired algorithms",
      icon: "🚀",
    },
    {
      id: "hpc_gpu" as const,
      label: "HPC GPU",
      description: "High-performance computing GPU for large-scale simulations",
      icon: "⚡",
    },
    {
      id: "quantum_qpu" as const,
      label: "Quantum QPU",
      description: "Real quantum processor execution (limited availability)",
      icon: "🔬",
    },
  ]

  // Function to select the optimal backend based on qubits, depth, and gateCount
  const selectOptimalBackend = ({ qubits, depth, gateCount }: { qubits: number; depth: number; gateCount: number }) => {
    if (qubits <= 10 && gateCount <= 100) {
      return "quantum_inspired_gpu"
    } else if (qubits <= 20 && gateCount <= 500) {
      return "hpc_gpu"
    } else {
      return "quantum_qpu"
    }
  }

  const recommendedBackend = selectOptimalBackend({ qubits, depth, gateCount: depth })

  return (
    <Card className="p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-3">
          <span className="text-primary font-bold text-base">4.</span>
          <h3 className="text-lg font-bold text-foreground">Execution Settings</h3>
        </div>
        <ChevronDown
          size={24}
          className={`text-primary transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
        />
      </div>

      {isExpanded && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Execution Mode</label>
            <div className="flex gap-2">
              <button
                onClick={() => handleModeChange("auto")}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                  mode === "auto"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                Auto
              </button>
              <button
                onClick={() => handleModeChange("manual")}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                  mode === "manual"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                Manual
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {mode === "auto"
                ? `Recommended: ${backends.find((b) => b.id === recommendedBackend)?.label}`
                : "Manually select execution backend"}
            </p>
          </div>

          {mode === "manual" && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-foreground">Backend Selection</label>
              {backends.map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleBackendChange(b.id)}
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
        </div>
      )}
    </Card>
  )
}
