"use client"

import { useState } from "react"
import { Zap } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface ParsedCircuit {
  gates: number
  depth: number
  qubitsUsed: number
}

export function AutoParser() {
  const [isParsing, setIsParsing] = useState(false)
  const [parsedData, setParsedData] = useState<ParsedCircuit | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  const handleParse = () => {
    setIsParsing(true)
    // Simulate parsing
    setTimeout(() => {
      setParsedData({
        gates: 12,
        depth: 5,
        qubitsUsed: 4,
      })
      setIsParsing(false)
    }, 1500)
  }

  return (
    <Card className="p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-foreground">AutoParser</h3>
        <button onClick={() => setIsExpanded(!isExpanded)} className="text-primary hover:text-primary/80 transition">
          {isExpanded ? "−" : "+"}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Automatically analyze your circuit and extract configuration details.
          </p>
          <Button
            onClick={handleParse}
            disabled={isParsing}
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
