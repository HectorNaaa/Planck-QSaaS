"use client"

import type React from "react"

import { useState } from "react"
import { Upload, X, ChevronDown, AlertCircle } from "lucide-react"
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

interface DatabaseUploaderProps {
  onDataUpload?: (data: any) => void
}

export function DatabaseUploader({ onDataUpload }: DatabaseUploaderProps) {
  const [selectedConfig, setSelectedConfig] = useState<DatabaseConfig | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0]
      setUploadedFile(file)
      setParseError(null)

      const validExtensions = [".json", ".csv", ".sql"]
      const fileExt = file.name.substring(file.name.lastIndexOf(".")).toLowerCase()

      if (!validExtensions.includes(fileExt)) {
        setParseError("Invalid file format. Please upload JSON, CSV, or SQL files only.")
        setUploadedFile(null)
        return
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string
          let data

          if (file.name.endsWith(".json")) {
            data = JSON.parse(content)
            if (!data || typeof data !== "object") {
              throw new Error("parse_error")
            }
          } else if (file.name.endsWith(".csv")) {
            const rows = content.split("\n").filter((row) => row.trim())
            if (rows.length < 2) {
              throw new Error("parse_error")
            }
            const headers = rows[0].split(",").map((h) => h.trim())
            if (headers.length === 0) {
              throw new Error("parse_error")
            }
            data = { raw: content, type: "csv" }
          } else if (file.name.endsWith(".sql")) {
            if (!content.trim()) {
              throw new Error("parse_error")
            }
            data = { raw: content, type: "sql" }
          }

          const qubits = data.qubits || 4
          const gates = data.gates || [
            { type: "h", targets: [0, 1, 2, 3] },
            { type: "cx", targets: [1], control: 0 },
          ]

          onDataUpload?.({ qubits, gates, depth: gates.length })
        } catch (error) {
          console.error("[v0] Failed to parse uploaded file:", error)
          setParseError("Uploaded file can not be parsed, consider adapting it.")
          setUploadedFile(null)
        }
      }
      reader.readAsText(file)
    }
  }

  const handleTemplateSelect = (configName: string) => {
    const config = mockConfigs.find((c) => c.name === configName)
    setSelectedConfig(config || null)

    if (config) {
      const templateData = {
        qubits: 4,
        gates: [
          { type: "h", targets: [0, 1, 2, 3] },
          { type: "cx", targets: [1], control: 0 },
          { type: "measure", targets: [0, 1, 2, 3] },
        ],
      }
      onDataUpload?.(templateData)
    }
  }

  return (
    <Card className="p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <h3 className="text-lg font-bold text-foreground">Database & Config</h3>
        <ChevronDown
          size={24}
          className={`text-primary transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
        />
      </div>

      {isExpanded && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Upload Structured Dataset</label>
            <div className="relative">
              <input
                type="file"
                onChange={handleFileUpload}
                accept=".json,.csv,.sql"
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 text-center hover:border-primary/50 transition">
                <Upload size={24} className="mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {uploadedFile ? uploadedFile.name : "Click to upload JSON, CSV, or SQL"}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Select Quantum Algorithm</label>
            <select
              value={selectedConfig?.name || ""}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground hover:border-primary/50 transition"
            >
              <option value="">Select a template...</option>
              {mockConfigs.map((config) => (
                <option key={config.name} value={config.name}>
                  {config.name} - {config.description}
                </option>
              ))}
            </select>
          </div>

          {parseError && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-2">
              <AlertCircle size={18} className="text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-destructive">{parseError}</p>
            </div>
          )}

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
                    setParseError(null)
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
