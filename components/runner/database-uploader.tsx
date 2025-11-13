"use client"

import type React from "react"

import { useState } from "react"
import { Upload, X } from "lucide-react"
import { Card } from "@/components/ui/card"

interface DatabaseConfig {
  name: string
  format: string
  description: string
}

const mockConfigs: DatabaseConfig[] = [
  { name: "Bell States", format: "QASM", description: "Quantum entanglement patterns" },
  { name: "VQE Ansatz", format: "Qiskit", description: "Variational quantum eigensolver" },
  { name: "QAOA Circuit", format: "QASM", description: "Quantum approximate optimization" },
]

export function DatabaseUploader() {
  const [selectedConfig, setSelectedConfig] = useState<DatabaseConfig | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setUploadedFile(e.target.files[0])
    }
  }

  return (
    <Card className="p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-foreground">Database & Config</h3>
        <button onClick={() => setIsExpanded(!isExpanded)} className="text-primary hover:text-primary/80 transition">
          {isExpanded ? "−" : "+"}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Upload Database</label>
            <div className="relative">
              <input
                type="file"
                onChange={handleFileUpload}
                accept=".qasm,.qpy,.json"
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 text-center hover:border-primary/50 transition">
                <Upload size={24} className="mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {uploadedFile ? uploadedFile.name : "Click to upload QASM, QPY, or JSON"}
                </p>
              </div>
            </div>
          </div>

          {/* Predefined Configs */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Or Select Template</label>
            <div className="space-y-2">
              {mockConfigs.map((config) => (
                <button
                  key={config.name}
                  onClick={() => setSelectedConfig(config)}
                  className={`w-full text-left p-3 rounded-lg transition ${
                    selectedConfig?.name === config.name
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary hover:bg-secondary/70 text-foreground"
                  }`}
                >
                  <div className="font-medium">{config.name}</div>
                  <div className="text-xs opacity-75">{config.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Selected Info */}
          {(selectedConfig || uploadedFile) && (
            <div className="p-3 bg-secondary/50 rounded-lg border border-primary/20">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{selectedConfig?.name || uploadedFile?.name}</p>
                  {selectedConfig && <p className="text-xs text-muted-foreground mt-1">{selectedConfig.description}</p>}
                </div>
                <button
                  onClick={() => {
                    setSelectedConfig(null)
                    setUploadedFile(null)
                  }}
                  className="text-muted-foreground hover:text-foreground transition"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
