"use client"

import { useState } from "react"
import { Zap, ChevronDown, AlertCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

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

  const handleParse = async () => {
    if (!inputData) {
      setError("Please upload a data file first before parsing")
      return
    }

    if (!algorithm) {
      setError("Please select an algorithm before parsing")
      return
    }

    setError(null)
    setIsParsing(true)

    try {
      let dataSize = 10
      let dataDimensions = 1

      if (Array.isArray(inputData)) {
        dataSize = inputData.length
        if (Array.isArray(inputData[0])) {
          dataDimensions = 2
          dataSize = inputData.length * inputData[0].length
        }
      } else if (typeof inputData === "object" && inputData !== null) {
        if (inputData.raw && inputData.type === "csv") {
          const rows = inputData.raw.split("\n").filter((r: string) => r.trim())
          dataSize = rows.length - 1
        } else {
          dataSize = Object.keys(inputData).length
        }
      }

      const qubitsNeeded = Math.max(2, Math.ceil(Math.log2(dataSize)))

      const depthEstimates: Record<string, (q: number, dims: number) => number> = {
        Bell: () => 3,
        Grover: (q, dims) => {
          const iterations = Math.ceil((Math.PI / 4) * Math.sqrt(Math.pow(2, q)))
          return iterations * (dims === 2 ? 2 : 1)
        },
        Shor: (q, dims) => q * 3 * (dims === 2 ? 1.5 : 1),
        VQE: (q, dims) => q * 5 * (dims === 2 ? 1.2 : 1),
        QAOA: (q, dims) => q * 4 * (dims === 2 ? 1.3 : 1),
      }

      const estimateDepth = depthEstimates[algorithm] || ((q: number) => q * 2)
      const circuitDepth = Math.ceil(estimateDepth(qubitsNeeded, dataDimensions))

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

      console.log("[v0] Parsed circuit from input data:", parsed)
      console.log("[v0] Data dimensions:", dataDimensions, "Data size:", dataSize)
    } catch (error) {
      console.error("[v0] Parsing error:", error)
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
            Automatically analyze your circuit and extract configuration details.
          </p>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-2">
              <AlertCircle size={18} className="text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-destructive font-medium">{error}</p>
            </div>
          )}

          <Button
            onClick={handleParse}
            disabled={isParsing || !inputData || !algorithm}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Zap size={18} className="mr-2" />
            {isParsing ? "Parsing..." : "Parse Circuit"}
          </Button>

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
