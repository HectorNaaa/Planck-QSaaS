"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Card } from "@/components/ui/card"

interface CircuitSettingsProps {
  onExecutionTypeChange?: (type: "auto" | "manual") => void
  onQubitsChange?: (qubits: number) => void
  onErrorMitigationChange?: (level: "none" | "low" | "medium" | "high") => void
}

export function CircuitSettings({
  onExecutionTypeChange,
  onQubitsChange,
  onErrorMitigationChange,
}: CircuitSettingsProps) {
  const [isAutomatic, setIsAutomatic] = useState(true)
  const [shots, setShots] = useState(1024)
  const [errorMitigation, setErrorMitigation] = useState<"none" | "low" | "medium" | "high">("none")
  const [isExpanded, setIsExpanded] = useState(false)

  const handleModeChange = (auto: boolean) => {
    setIsAutomatic(auto)
    onExecutionTypeChange?.(auto ? "auto" : "manual")
  }

  const handleErrorMitigationChange = (value: "none" | "low" | "medium" | "high") => {
    setErrorMitigation(value)
    onErrorMitigationChange?.(value)
  }

  return (
    <Card className="p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-3">
          <span className="text-primary font-bold text-base">3.</span>
          <h3 className="text-lg font-bold text-foreground">Circuit Settings</h3>
        </div>
        <ChevronDown
          size={24}
          className={`text-primary transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
        />
      </div>

      {isExpanded && (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-3">Mode</label>
            <div className="flex gap-2">
              <button
                onClick={() => handleModeChange(true)}
                className={`flex-1 py-2 px-3 rounded-lg transition font-medium ${
                  isAutomatic
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground hover:bg-secondary/70"
                }`}
              >
                Automatic
              </button>
              <button
                onClick={() => handleModeChange(false)}
                className={`flex-1 py-2 px-3 rounded-lg transition font-medium ${
                  !isAutomatic
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground hover:bg-secondary/70"
                }`}
              >
                Manual
              </button>
            </div>
          </div>

          {isAutomatic ? (
            <div className="space-y-3">
              <div className="p-3 bg-secondary/50 rounded-lg border border-primary/20">
                <p className="text-sm text-foreground font-medium">Automatic mode enabled</p>
                <p className="text-xs text-muted-foreground mt-1">Optimal settings: 1024 Shots, No Error Mitigation</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Shots: {shots}</label>
                <select
                  value={shots}
                  onChange={(e) => setShots(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                >
                  <option value={512}>512 shots</option>
                  <option value={1024}>1024 shots</option>
                  <option value={2048}>2048 shots</option>
                  <option value={4096}>4096 shots</option>
                  <option value={8192}>8192 shots</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Error Mitigation</label>
                <select
                  value={errorMitigation}
                  onChange={(e) => handleErrorMitigationChange(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                >
                  <option value="none">None (Default)</option>
                  <option value="low">Low - Basic mitigation</option>
                  <option value="medium">Medium - Standard mitigation</option>
                  <option value="high">High - Maximum mitigation</option>
                </select>
                <p className="text-xs text-muted-foreground mt-2">
                  {errorMitigation === "none" && "No error mitigation applied"}
                  {errorMitigation === "low" && "Low error mitigation applied"}
                  {errorMitigation === "medium" && "Medium error mitigation applied"}
                  {errorMitigation === "high" && "High error mitigation applied"}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
