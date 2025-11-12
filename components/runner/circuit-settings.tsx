"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"

export function CircuitSettings() {
  const [isAutomatic, setIsAutomatic] = useState(true)
  const [qubits, setQubits] = useState(4)
  const [shots, setShots] = useState(1024)
  const [errorMitigation, setErrorMitigation] = useState<"none" | "low" | "medium" | "high">("none")

  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold text-foreground mb-4">Circuit Settings</h3>

      <div className="mb-4">
        <label className="block text-sm font-medium text-foreground mb-3">Mode</label>
        <div className="flex gap-2">
          <button
            onClick={() => setIsAutomatic(true)}
            className={`flex-1 py-2 px-3 rounded-lg transition font-medium ${
              isAutomatic ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/70"
            }`}
          >
            Automatic
          </button>
          <button
            onClick={() => setIsAutomatic(false)}
            className={`flex-1 py-2 px-3 rounded-lg transition font-medium ${
              !isAutomatic ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/70"
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
            <p className="text-xs text-muted-foreground mt-1">
              Optimal settings: 4 Qubits, 1024 Shots, No Error Mitigation
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Qubits: {qubits}</label>
            <input
              type="range"
              min="1"
              max="15"
              value={qubits}
              onChange={(e) => setQubits(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">1-15 qubits available</p>
          </div>

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
              onChange={(e) => setErrorMitigation(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
            >
              <option value="none">None (Default)</option>
              <option value="low">Low - Basic noise suppression</option>
              <option value="medium">Medium - Standard calibration</option>
              <option value="high">High - Full error correction</option>
            </select>
            <p className="text-xs text-muted-foreground mt-2">
              {errorMitigation === "none" && "No error mitigation applied"}
              {errorMitigation === "low" && "Basic noise suppression techniques applied"}
              {errorMitigation === "medium" && "Standard calibration and noise suppression"}
              {errorMitigation === "high" && "Full quantum error correction enabled"}
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}
