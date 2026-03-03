/**
 * components/dashboard/digital-twin-dashboard.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable dashboard panel that shows 3 live-updating charts (latency, backend
 * distribution, success rate) plus a runs table for either:
 *   • the global view (all executions for the current user), or
 *   • a specific digital twin (filtered by digital_twin_id).
 *
 * When `liveEnabled` is true the component opens an SSE connection via the
 * `useLiveExecutions` hook and appends new rows in real-time without a page
 * refresh. The same component is used in two places:
 *   1. The general dashboard tab (no filter)
 *   2. Each per-DT tab in the dashboard page
 */

"use client"

import { useRef, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Wifi, WifiOff } from "lucide-react"
import { Line } from "react-chartjs-2"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js"
import { useLiveExecutions, type ExecutionRow } from "@/hooks/use-live-executions"

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

// ─── Brand palette ───────────────────────────────────────────────────────────
const G1 = "rgb(87, 142, 126)"   // deep — chart-1 / primary
const G2 = "rgb(107, 163, 154)"  // mid  — chart-2
const G1_A = "rgba(87, 142, 126, 0.12)"
const GRAY = "rgb(100, 100, 100)"

// ─── Types ───────────────────────────────────────────────────────────────────
interface Props {
  /** Rows pre-loaded from an SSR/SWR query. The hook will append live rows. */
  initialRows?: ExecutionRow[]
  /** When true the SSE connection is opened. */
  liveEnabled: boolean
  /** If set, the SSE stream and table are filtered to this DT. */
  digitalTwinId?: string | null
  /** Display name shown in chart titles */
  title?: string
  timeRange?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const backendNum: Record<string, number> = {
  quantum_inspired_gpu: 1,
  hpc_gpu: 2,
  quantum_qpu: 3,
}
const backendLabel = (b: string | null) =>
  b === "quantum_qpu" ? "QPU" : b === "hpc_gpu" ? "HPC" : "QI-GPU"

function downloadChart(ref: any, name: string) {
  if (!ref.current) return
  const url = ref.current.canvas.toDataURL()
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
}

const baseChartOptions = (yLabel?: string) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 400 },
  interaction: { mode: "index" as const, intersect: false },
  plugins: {
    legend: { display: true, position: "top" as const, labels: { boxWidth: 10, font: { size: 11 } } },
    title: { display: false },
  },
  scales: {
    y: {
      type: "linear" as const,
      display: true,
      position: "left" as const,
      beginAtZero: true,
      title: { display: !!yLabel, text: yLabel },
    },
    y1: {
      type: "linear" as const,
      display: true,
      position: "right" as const,
      beginAtZero: true,
      grid: { drawOnChartArea: false },
    },
  },
})

// ─── Component ───────────────────────────────────────────────────────────────
export function DigitalTwinDashboard({
  initialRows = [],
  liveEnabled,
  digitalTwinId = null,
  title = "All Digital Twins",
  timeRange = "7d",
}: Props) {
  const latRef = useRef<any>(null)
  const backRef = useRef<any>(null)
  const sucRef = useRef<any>(null)

  const { rows, connected, error } = useLiveExecutions({
    enabled: liveEnabled,
    digitalTwinId,
    initialRows,
  })

  // Limit chart to last 80 points for readability
  const chartRows = useMemo(() => rows.slice(-80), [rows])
  const labels = useMemo(() => chartRows.map((_, i) => `#${i + 1}`), [chartRows])

  // Chart datasets
  const latencyData = useMemo(() => ({
    labels,
    datasets: [
      {
        label: "Runtime (ms)",
        data: chartRows.map((r) => Math.round(r.runtime_ms || 0)),
        borderColor: G1, backgroundColor: G1_A, tension: 0.4, fill: true, yAxisID: "y",
        pointRadius: 2, borderWidth: 2,
      },
      {
        label: "Qubits",
        data: chartRows.map((r) => r.qubits_used || 0),
        borderColor: GRAY, backgroundColor: "transparent", tension: 0.4, fill: false,
        pointRadius: 3, pointBorderColor: GRAY, yAxisID: "y1", borderWidth: 1.5,
      },
    ],
  }), [chartRows, labels])

  const backendData = useMemo(() => ({
    labels,
    datasets: [
      {
        label: "Backend",
        data: chartRows.map((r) => backendNum[r.backend_selected ?? ""] ?? 1),
        borderColor: G2, backgroundColor: "rgba(107,163,154,0.12)", tension: 0.4, fill: true,
        yAxisID: "y", pointRadius: 2, borderWidth: 2,
      },
      {
        label: "Shots",
        data: chartRows.map((r) => Math.round((r.shots || 0) / 100)),
        borderColor: GRAY, backgroundColor: "transparent", tension: 0.4, fill: false,
        pointRadius: 2, yAxisID: "y1", borderWidth: 1.5,
      },
    ],
  }), [chartRows, labels])

  const backendOptions = useMemo(() => ({
    ...baseChartOptions(),
    plugins: {
      ...baseChartOptions().plugins,
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            if (ctx.dataset.label === "Backend") {
              const r = chartRows[ctx.dataIndex]
              return `${r?.circuit_name ?? ""} — ${backendLabel(r?.backend_selected ?? null)}`
            }
            return `Shots ×100: ${ctx.parsed.y}`
          },
        },
      },
    },
    scales: {
      ...baseChartOptions().scales,
      y: {
        ...baseChartOptions().scales.y,
        ticks: { callback: (v: any) => ["", "QI-GPU", "HPC", "QPU"][v] ?? "", stepSize: 1 },
        min: 0, max: 4,
      },
    },
  }), [chartRows])

  const successData = useMemo(() => ({
    labels,
    datasets: [
      {
        label: "Success rate (%)",
        data: chartRows.map((r) => Math.round((r.success_rate || 0) * 100) / 100),
        borderColor: G1, backgroundColor: G1_A, tension: 0.4, fill: true,
        yAxisID: "y", pointRadius: 2, borderWidth: 2,
      },
      {
        label: "Qubits",
        data: chartRows.map((r) => r.qubits_used || 0),
        borderColor: GRAY, backgroundColor: "transparent", tension: 0.4, fill: false,
        pointRadius: 3, yAxisID: "y1", borderWidth: 1.5,
      },
    ],
  }), [chartRows, labels])

  return (
    <div className="space-y-6">
      {/* Live indicator */}
      {liveEnabled && (
        <div className="flex items-center gap-2 text-xs">
          {connected
            ? <><Wifi size={13} className="text-primary" /><span className="text-primary">Live — updating every 3 s</span></>
            : <><WifiOff size={13} className="text-muted-foreground" /><span className="text-muted-foreground">Connecting…</span></>}
          {error && <span className="text-destructive ml-2">{error}</span>}
          <span className="text-muted-foreground ml-auto">{rows.length} run{rows.length !== 1 ? "s" : ""} loaded</span>
        </div>
      )}

      {/* 3 charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latency */}
        <Card className="p-5 shadow-lg bg-secondary">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-foreground">Execution Latency</h3>
            <Button variant="ghost" size="sm" onClick={() => downloadChart(latRef, "latency.png")}>
              <Download size={14} />
            </Button>
          </div>
          <div className="h-52">
            {chartRows.length === 0
              ? <p className="text-xs text-muted-foreground text-center pt-16">No data yet</p>
              : <Line ref={latRef} data={latencyData} options={baseChartOptions("ms")} />}
          </div>
        </Card>

        {/* Backend */}
        <Card className="p-5 shadow-lg bg-secondary">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-foreground">Backend Selection</h3>
            <Button variant="ghost" size="sm" onClick={() => downloadChart(backRef, "backends.png")}>
              <Download size={14} />
            </Button>
          </div>
          <div className="h-52">
            {chartRows.length === 0
              ? <p className="text-xs text-muted-foreground text-center pt-16">No data yet</p>
              : <Line ref={backRef} data={backendData} options={backendOptions} />}
          </div>
        </Card>

        {/* Success rate */}
        <Card className="p-5 shadow-lg bg-secondary">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-foreground">Success Rate</h3>
            <Button variant="ghost" size="sm" onClick={() => downloadChart(sucRef, "success.png")}>
              <Download size={14} />
            </Button>
          </div>
          <div className="h-52">
            {chartRows.length === 0
              ? <p className="text-xs text-muted-foreground text-center pt-16">No data yet</p>
              : <Line ref={sucRef} data={successData} options={baseChartOptions("%")} />}
          </div>
        </Card>
      </div>

      {/* Runs table */}
      <Card className="p-5 shadow-lg bg-secondary">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold text-foreground">
            Runs — {title}
            {liveEnabled && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">(live)</span>
            )}
          </h3>
          <span className="text-xs text-muted-foreground">{rows.length} total</span>
        </div>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No runs in this period.</p>
        ) : (
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-secondary z-10">
                <tr className="border-b border-border">
                  {["Src", "Algorithm", "Name", "Status", "Backend", "Qubits", "Shots", "Runtime", "Time"].map((h) => (
                    <th key={h} className="text-left py-2 px-2 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/70 transition leading-none">
                    <td className="py-1.5 px-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${r.circuit_data?.source === "sdk" ? "bg-blue-500/20 text-blue-400" : "bg-primary/15 text-primary"}`}>
                        {r.circuit_data?.source === "sdk" ? "SDK" : "UI"}
                      </span>
                    </td>
                    <td className="py-1.5 px-2">
                      <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium">{r.algorithm || "—"}</span>
                    </td>
                    <td className="py-1.5 px-2 font-medium text-foreground">{r.circuit_name || "—"}</td>
                    <td className="py-1.5 px-2">
                      <span className={`px-1.5 py-0.5 rounded-full whitespace-nowrap font-medium ${r.status === "completed" ? "bg-primary/15 text-primary" : r.status === "running" ? "bg-accent/15 text-accent" : "bg-destructive/15 text-destructive"}`}>
                        {r.status === "completed" ? "Success" : r.status === "running" ? "Running" : r.status || "—"}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 font-mono text-muted-foreground">{backendLabel(r.backend_selected)}</td>
                    <td className="py-1.5 px-2 text-foreground">{r.qubits_used ?? "—"}</td>
                    <td className="py-1.5 px-2 text-muted-foreground">{r.shots ?? "—"}</td>
                    <td className="py-1.5 px-2 text-foreground">{r.runtime_ms ? `${Math.round(Number(r.runtime_ms))}ms` : "—"}</td>
                    <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
