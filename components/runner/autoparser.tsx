"use client"

import { useState, useEffect } from "react"
import { ChevronDown, AlertCircle } from "lucide-react"
import { Card } from "@/components/ui/card"

interface ParsedCircuit {
  gates: number
  depth: number
  qubitsUsed: number
}

interface AutoParserProps {
  onParsed?: (data: ParsedCircuit) => void
  inputData?: any
  algorithm?: string
}

export function AutoParser({ onParsed, inputData, algorithm }: AutoParserProps) {
  const [isParsing, setIsParsing] = useState(false)
  const [parsedData, setParsedData] = useState<ParsedCircuit | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCircuitParsed = (event: CustomEvent) => {
      const { gates, depth, qubitsUsed } = event.detail
      setParsedData({ gates, depth, qubitsUsed })
      setError(null)
    }

    if (typeof window !== "undefined") {
      window.addEventListener("circuit-parsed" as any, handleCircuitParsed as any)
      return () => {
        window.removeEventListener("circuit-parsed" as any, handleCircuitParsed as any)
      }
    }
  }, [])

  useEffect(() => {
    if (inputData && algorithm && !isParsing) {
      handleParse()
    }
  }, [inputData, algorithm])

  const handleParse = async () => {
    if (!inputData) {
      setError("Please upload a data file first before parsing")
      return
    }

    if (!algorithm) {
      setError("Please select a case before parsing")
      return
    }

    setError(null)
    setIsParsing(true)

    try {
      let dataSize = 10
      let dataDimensions = 1
      let features = 1

      if (Array.isArray(inputData)) {
        dataSize = inputData.length
        if (Array.isArray(inputData[0])) {
          dataDimensions = 2
          features = inputData[0].length
          dataSize = inputData.length * features
        }
      } else if (typeof inputData === "object" && inputData !== null) {
        if (inputData.raw && inputData.type === "csv") {
          const rows = inputData.raw.split("\n").filter((r: string) => r.trim())
          dataSize = rows.length - 1
          if (rows.length > 0) {
            features = rows[0].split(",").length
          }
        } else {
          dataSize = Object.keys(inputData).length
          features = dataSize
        }
      }

      const recommendedQubits = Math.max(2, Math.ceil(Math.log2(dataSize || 4)))
      const qubitsNeeded = Math.min(recommendedQubits, 20) // Cap at 20

      const complexity = Math.max(1, Math.ceil(Math.sqrt(features)))
      const layers = Math.max(1, Math.min(3, Math.floor(features / 2)))

      const depthEstimates: Record<string, (q: number, dims: number, comp: number) => number> = {
        Bell: () => 3,
        Grover: (q, dims, comp) => {
          const iterations = Math.ceil((Math.PI / 4) * Math.sqrt(Math.pow(2, q)))
          return Math.ceil(iterations * comp * (dims === 2 ? 2 : 1))
        },
        Shor: (q, dims) => Math.ceil(q * 3 * (dims === 2 ? 1.5 : 1)),
        VQE: (q, dims, comp) => Math.ceil(10 + Math.floor(features / 2)),
        QAOA: (q, dims, comp) => Math.ceil(6 + layers),
      }

      const estimateDepth = depthEstimates[algorithm] || ((q: number) => q * 2)
      const circuitDepth = estimateDepth(qubitsNeeded, dataDimensions, complexity)

      const gateMultipliers: Record<string, number> = {
        Bell: 3,
        Grover: 8,
        Shor: 12,
        VQE: 15,
        QAOA: 10,
      }
      const baseGates = (gateMultipliers[algorithm] || 5) * qubitsNeeded
      const gateCount = Math.ceil(baseGates * (dataDimensions === 2 ? 1.4 : 1))

      const parsed: ParsedCircuit = {
        gates: gateCount,
        depth: circuitDepth,
        qubitsUsed: qubitsNeeded,
      }

      setParsedData(parsed)
      onParsed?.(parsed)

      console.log("Parsed base circuit from input data:", parsed)
      console.log("Data: size=", dataSize, "features=", features, "dimensions=", dataDimensions)

      // Dispatch event for other components
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("circuit-parsed", {
            detail: {
              gates: gateCount,
              depth: circuitDepth,
              qubitsUsed: qubitsNeeded,
            },
          }),
        )
      }
    } catch (error) {
      console.error("Parsing error:", error)
      setError("Failed to parse circuit. Please check your input data.")
    } finally {
      setIsParsing(false)
    }
  }

  return (
    <Card className="p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-3">
          <span className="text-primary font-bold text-base">2.</span>
          <h3 className="text-lg font-bold text-foreground">AutoParser</h3>
        </div>
        <ChevronDown
          size={24}
          className={`text-primary transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
        />
      </div>

      {isExpanded && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Automatically analyze your data and extract base circuit configuration details.
          </p>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-2">
              <AlertCircle size={18} className="text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-destructive font-medium">{error}</p>
            </div>
          )}

          <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
            <p className="text-sm text-foreground font-medium">✓ Automatic parsing enabled</p>
            <p className="text-xs text-muted-foreground">
              Circuit parameters update automatically when data or case changes
            </p>
          </div>

          {parsedData && (
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-secondary/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Gates</p>
                <p className="text-lg font-bold text-foreground">{parsedData.gates}</p>
              </div>
              <div className="p-3 bg-secondary/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Depth</p>
                <p className="text-lg font-bold text-foreground">{parsedData.depth}</p>
              </div>
              <div className="p-3 bg-secondary/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Qubits</p>
                <p className="text-lg font-bold text-foreground">{parsedData.qubitsUsed}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
