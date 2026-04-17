"use client"

import { useState, useEffect } from "react"
import { ChevronDown, AlertCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
// analyzeInputData is a pure function — safe to import client-side as it has
// no Node.js dependencies (no fs, child_process, etc.)
import { analyzeInputData } from "@/lib/circuit-builder"

const DATA_SCALE_LABELS: Record<string, { label: string; color: string }> = {
  small:   { label: "Small (<1K rows)",     color: "text-green-500" },
  medium:  { label: "Medium (<50K rows)",   color: "text-yellow-500" },
  large:   { label: "Large (<10M rows)",    color: "text-orange-500" },
  massive: { label: "Massive (≥10M rows)",  color: "text-red-500" },
}

interface ParsedCircuit {
  gates: number
  depth: number
  qubitsUsed: number
  layers: number
  paramSummary: string
  dataScale: string
}

interface AutoParserProps {
  onParsed?: (data: ParsedCircuit) => void
  inputData?: unknown
  algorithm?: string
}

export function AutoParser({ onParsed, inputData, algorithm }: AutoParserProps) {
  const [isParsing, setIsParsing]   = useState(false)
  const [parsedData, setParsedData] = useState<ParsedCircuit | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // Listen for external circuit-parsed events (e.g. from the visualiser)
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const { gates, depth, qubitsUsed, layers = 1, dataScale = "small" } = e.detail
      setParsedData({ gates, depth, qubitsUsed, layers, dataScale, paramSummary: "" })
      setError(null)
    }
    window.addEventListener("circuit-parsed" as any, handler as any)
    return () => window.removeEventListener("circuit-parsed" as any, handler as any)
  }, [])

  // Auto-run whenever data or algorithm changes
  useEffect(() => {
    if (inputData && algorithm && !isParsing) handleParse()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputData, algorithm])

  const handleParse = () => {
    if (!inputData)  { setError("Upload a data file first."); return }
    if (!algorithm)  { setError("Select a case before parsing."); return }

    setError(null)
    setIsParsing(true)
    try {
      // Delegate all data analysis to the shared circuit-builder utility so
      // the autoparser and the server-side circuit generator stay in sync.
      const profile = analyzeInputData(inputData)

      const parsed: ParsedCircuit = {
        gates:       profile.gateCount,
        depth:       profile.depth,
        qubitsUsed:  profile.qubits,
        layers:      profile.layers,
        dataScale:   profile.dataScale,
        paramSummary: `${profile.featureCount} feature(s), ${profile.sampleCount.toLocaleString()} sample(s) → ${profile.qubits} qubits, ${profile.layers} layer(s) [${profile.dataScale}]`,
      }

      setParsedData(parsed)
      onParsed?.(parsed)

      window.dispatchEvent(
        new CustomEvent("circuit-parsed", {
          detail: { gates: parsed.gates, depth: parsed.depth, qubitsUsed: parsed.qubitsUsed },
        }),
      )
    } catch (err) {
      setError("Failed to parse circuit data.")
      console.error("[AutoParser] parse error:", err)
    } finally {
      setIsParsing(false)
    }
  }

  return (
    <Card className="p-6 shadow-lg">
      <div
        className="flex items-center justify-between mb-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
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
          <p className="text-xs text-muted-foreground">
            Extracts circuit parameters from your data automatically.
          </p>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-2">
              <AlertCircle size={18} className="text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-destructive font-medium">{error}</p>
            </div>
          )}

          <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
            <p className="text-xs text-foreground font-medium">
              {isParsing ? "Analysing..." : "Auto-parse active — updates on data/case change"}
            </p>
          </div>

          {parsedData && (
            <>
              <div className="grid grid-cols-4 gap-2">
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
                <div className="p-3 bg-secondary/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Layers</p>
                  <p className="text-lg font-bold text-foreground">{parsedData.layers}</p>
                </div>
              </div>
              {parsedData.dataScale && (() => {
                const { label, color } = DATA_SCALE_LABELS[parsedData.dataScale] ?? { label: parsedData.dataScale, color: "text-muted-foreground" }
                return (
                  <p className={`text-xs font-semibold ${color}`}>Dataset scale: {label}</p>
                )
              })()}
              {parsedData.paramSummary && (
                <p className="text-[11px] text-muted-foreground font-mono">{parsedData.paramSummary}</p>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  )
}
