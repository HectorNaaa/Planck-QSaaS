"use client"

import { useState } from "react"
import { Zap, ChevronDown } from "lucide-react"
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

  const handleParse = async () => {
    if (!inputData || !algorithm) {
      console.log("[v0] No input data or algorithm selected")
      return
    }

    setIsParsing(true)

    try {
      const dataSize = Array.isArray(inputData) ? inputData.length : Object.keys(inputData).length || 10
      const qubitsNeeded = Math.max(2, Math.ceil(Math.log2(dataSize)))

      // Algorithm-specific depth estimation
      const depthEstimates: Record<string, (q: number) => number> = {
        Bell: () => 3,
        Grover: (q) => Math.ceil((Math.PI / 4) * Math.sqrt(Math.pow(2, q))),
        Shor: (q) => q * 3,
        VQE: (q) => q * 5,
        QAOA: (q) => q * 4,
      }

      const estimateDepth = depthEstimates[algorithm] || ((q) => q * 2)
      const circuitDepth = estimateDepth(qubitsNeeded)

      // Estimate gate count based on algorithm
      const gateMultipliers: Record<string, number> = {
        Bell: 3,
        Grover: 8,
        Shor: 12,
        VQE: 15,
        QAOA: 10,
      }
      const gateCount = (gateMultipliers[algorithm] || 5) * qubitsNeeded

      const parsed: ParsedCircuit = {
        gates: gateCount,
        depth: circuitDepth,
        qubitsUsed: qubitsNeeded,
      }

      setParsedData(parsed)
      onParsed?.(parsed)

      console.log("[v0] Parsed circuit from input data:", parsed)
    } catch (error) {
      console.error("[v0] Parsing error:", error)
    } finally {
      setIsParsing(false)
    }
  }

  return (
    <Card className="p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <h3 className="text-lg font-bold text-foreground">AutoParser</h3>
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
