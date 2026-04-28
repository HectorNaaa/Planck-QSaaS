"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Card } from "@/components/ui/card"

type ExecutionBackend = "quantum_inspired_gpu" | "hpc_gpu" | "quantum_qpu"

interface ExecutionSettingsProps {
  onBackendChange?: (backend: ExecutionBackend) => void
  currentBackend?: ExecutionBackend
  onModeChange?: (mode: "auto" | "manual") => void
  onShotsChange?: (shots: number) => void
  currentShots?: number
  autoShots?: number
  qubits: number
  depth: number
  /** Reason why the auto-router selected the backend on the last run. */
  postRunReason?: string | null
}

/** Human-readable labels for compute routes */
export const COMPUTE_ROUTE_LABELS: Record<ExecutionBackend, { name: string; badge: string; description: string; icon: string }> = {
  quantum_inspired_gpu: {
    name: "Quantum-inspired GPU",
    badge: "fastest · lower cost",
    description: "Classical GPU with quantum-inspired algorithms. Best for most workloads.",
    icon: "🚀",
  },
  hpc_gpu: {
    name: "Quantum-inspired HPC",
    badge: "most stable",
    description: "High-performance computing GPU. Higher fidelity, ideal for stress tests.",
    icon: "⚡",
  },
  quantum_qpu: {
    name: "Quantum QPU",
    badge: "high fidelity · experimental",
    description: "Real quantum processor. Best accuracy but limited availability.",
    icon: "🔬",
  },
}

export function ExecutionSettings({
  onBackendChange,
  currentBackend,
  onModeChange,
  onShotsChange,
  currentShots,
  autoShots,
  qubits,
  depth,
  postRunReason,
}: ExecutionSettingsProps) {
  const [backend, setBackend] = useState<ExecutionBackend>(currentBackend || "quantum_inspired_gpu")
  const [isExpanded, setIsExpanded] = useState(false)
  const [mode, setMode] = useState<"auto" | "manual">("auto")
  const [manualShots, setManualShots] = useState(currentShots || 1024)

  const handleBackendChange = (newBackend: ExecutionBackend) => {
    setBackend(newBackend)
    onBackendChange?.(newBackend)
  }

  const handleModeChange = (newMode: "auto" | "manual") => {
    setMode(newMode)
    onModeChange?.(newMode)
  }

  const handleShotsChange = (newShots: number) => {
    setManualShots(newShots)
    onShotsChange?.(newShots)
  }

  const backends = Object.entries(COMPUTE_ROUTE_LABELS).map(([id, meta]) => ({
    id: id as ExecutionBackend,
    ...meta,
  }))

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
          <h3 className="text-lg font-bold text-foreground">Compute Route</h3>
        </div>
        <ChevronDown
          size={24}
          className={`text-primary transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
        />
      </div>

      {isExpanded && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Routing Mode</label>
            <div className="flex gap-2">
              <button
                onClick={() => handleModeChange("auto")}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                  mode === "auto"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                Auto-route
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
                ? `Recommended: ${COMPUTE_ROUTE_LABELS[recommendedBackend as ExecutionBackend]?.name ?? recommendedBackend}`
                : "Manually select compute route"}
            </p>
            {mode === "auto" && postRunReason && (
              <div className="mt-2 px-3 py-2 bg-secondary/40 rounded-lg border border-border">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">Auto-routing: </span>
                  {postRunReason}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Sampling Budget</label>
            {mode === "auto" ? (
              <div className="px-4 py-3 bg-secondary/50 rounded-lg">
                <p className="text-lg font-bold text-foreground">{autoShots || "Calculating..."}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Automatically calculated based on model complexity and error accumulation
                </p>
              </div>
            ) : (
              <div>
                <input
                  type="number"
                  value={manualShots}
                  onChange={(e) => handleShotsChange(Number(e.target.value))}
                  className="w-full px-4 py-2 border-2 border-secondary rounded-lg focus:border-primary focus:outline-none"
                  min={100}
                  max={10000}
                  step={100}
                />
                <p className="text-xs text-muted-foreground mt-1">Range: 100 – 10,000 samples</p>
              </div>
            )}
          </div>

          {mode === "manual" && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-foreground">Compute Route</label>
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground">{b.name}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">{b.badge}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{b.description}</p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
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
