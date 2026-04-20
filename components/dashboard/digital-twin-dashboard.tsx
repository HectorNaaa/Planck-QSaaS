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

import { useRef, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Download, Wifi, WifiOff, Search, X } from "lucide-react"
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
  initialRows?: ExecutionRow[]
  liveEnabled: boolean
  apiKey?: string | null
  digitalTwinId?: string | null
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
  apiKey = null,
  digitalTwinId = null,
  title = "All Digital Twins",
  timeRange = "7d",
}: Props) {
  const latRef = useRef<any>(null)
  const backRef = useRef<any>(null)
  const sucRef = useRef<any>(null)

  // ── Search + filter state ────────────────────────────────────────────────
  const [search, setSearch] = useState("")
  const [filterBackend, setFilterBackend] = useState("all")
  const [filterMinQubits, setFilterMinQubits] = useState(0)
  const [filterMinShots, setFilterMinShots] = useState(0)
  const [filterMaxRuntime, setFilterMaxRuntime] = useState(0) // 0 = any; -1 = >1000ms

  const hasActiveFilters = search.trim() !== "" || filterBackend !== "all" || filterMinQubits > 0 || filterMinShots > 0 || filterMaxRuntime !== 0

  const { rows, connected, error } = useLiveExecutions({
    enabled: liveEnabled,
    digitalTwinId,
    initialRows,
    apiKey,
  })

  // Limit chart to last 80 points for readability
  const chartRows = useMemo(() => rows.slice(-80), [rows])
  const labels = useMemo(() => chartRows.map((_, i) => `#${i + 1}`), [chartRows])

  // ── Filtered table rows ───────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    let result = [...rows].reverse() // newest first
    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter(
        (r) =>
          (r.circuit_name || "").toLowerCase().includes(q) ||
          (r.algorithm || "").toLowerCase().includes(q),
      )
    }
    if (filterBackend !== "all") {
      result = result.filter((r) => r.backend_selected === filterBackend)
    }
    if (filterMinQubits > 0) {
      result = result.filter((r) => (r.qubits_used ?? 0) >= filterMinQubits)
    }
    if (filterMinShots > 0) {
      result = result.filter((r) => (r.shots ?? 0) >= filterMinShots)
    }
    if (filterMaxRuntime !== 0) {
      if (filterMaxRuntime === -1) {
        result = result.filter((r) => (r.runtime_ms ?? 0) > 1000)
      } else {
        result = result.filter((r) => (r.runtime_ms ?? 0) <= filterMaxRuntime)
      }
    }
    return result
  }, [rows, search, filterBackend, filterMinQubits, filterMinShots, filterMaxRuntime])

  // ── Per-row download ──────────────────────────────────────────────────────
  function downloadRow(r: ExecutionRow) {
    const payload = {
      id: r.id,
      circuit_name: r.circuit_name,
      algorithm: r.algorithm,
      status: r.status,
      created_at: r.created_at,
      backend_selected: r.backend_selected,
      backend_reason: r.circuit_data?.backend_reason ?? null,
      qubits_used: r.qubits_used,
      shots: r.shots,
      runtime_ms: r.runtime_ms,
      success_rate: r.success_rate,
      error_mitigation: r.error_mitigation,
      digital_twin_id: r.digital_twin_id,
      // QASM of the executed quantum circuit
      qasm: r.circuit_data?.qasm ?? null,
      // Full circuit_data — includes fidelity, counts, ML tuning
      circuit_data: r.circuit_data ?? null,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const safeName = (r.circuit_name || r.algorithm || `exec-${r.id.slice(0, 8)}`).replace(/\s+/g, "_")
    a.href = url
    a.download = `${safeName}_${r.id.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

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
        label: "Qubits",
        data: chartRows.map((r) => r.qubits_used || 0),
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
            return `Qubits: ${ctx.parsed.y}`
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
      {/* Live indicator — only shown when SSE is active */}
      {liveEnabled && (
        <div className="flex items-center gap-2 text-xs">
          {connected
            ? <><Wifi size={13} className="text-primary" /><span className="text-primary">Live — near real-time</span></>
            : <><WifiOff size={13} className="text-muted-foreground" /><span className="text-muted-foreground">Connecting…</span></>
          }
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
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            Runs — {title}
            {liveEnabled && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">(live)</span>
            )}
          </h3>
          <span className="text-xs text-muted-foreground">
            {rows.length} total{filteredRows.length !== rows.length ? `, ${filteredRows.length} shown` : ""}
          </span>
        </div>

        {/* Search + filters */}
        <div className="flex flex-wrap gap-2 mb-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name / algorithm…"
              className="pl-7 h-7 text-xs"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={11} />
              </button>
            )}
          </div>

          {/* Backend filter */}
          <select
            value={filterBackend}
            onChange={(e) => setFilterBackend(e.target.value)}
            className="h-7 text-xs rounded-md border border-input bg-background px-2 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">All backends</option>
            <option value="quantum_inspired_gpu">QI-GPU</option>
            <option value="hpc_gpu">HPC</option>
            <option value="quantum_qpu">QPU</option>
          </select>

          {/* Min qubits */}
          <select
            value={filterMinQubits}
            onChange={(e) => setFilterMinQubits(Number(e.target.value))}
            className="h-7 text-xs rounded-md border border-input bg-background px-2 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value={0}>Any qubits</option>
            <option value={2}>≥ 2 qubits</option>
            <option value={4}>≥ 4 qubits</option>
            <option value={8}>≥ 8 qubits</option>
            <option value={16}>≥ 16 qubits</option>
            <option value={32}>≥ 32 qubits</option>
          </select>

          {/* Min shots */}
          <select
            value={filterMinShots}
            onChange={(e) => setFilterMinShots(Number(e.target.value))}
            className="h-7 text-xs rounded-md border border-input bg-background px-2 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value={0}>Any shots</option>
            <option value={256}>≥ 256</option>
            <option value={512}>≥ 512</option>
            <option value={1024}>≥ 1 024</option>
            <option value={4096}>≥ 4 096</option>
          </select>

          {/* Runtime filter */}
          <select
            value={filterMaxRuntime}
            onChange={(e) => setFilterMaxRuntime(Number(e.target.value))}
            className="h-7 text-xs rounded-md border border-input bg-background px-2 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value={0}>Any runtime</option>
            <option value={100}>≤ 100 ms</option>
            <option value={500}>≤ 500 ms</option>
            <option value={1000}>≤ 1 000 ms</option>
            <option value={-1}>{"> 1 000 ms"}</option>
          </select>

          {/* Clear all filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
              onClick={() => { setSearch(""); setFilterBackend("all"); setFilterMinQubits(0); setFilterMinShots(0); setFilterMaxRuntime(0) }}
            >
              <X size={11} className="mr-1" />Clear
            </Button>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No runs in this period.</p>
        ) : filteredRows.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No runs match the current filters.</p>
        ) : (
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-secondary z-10">
                <tr className="border-b border-border">
                  {["Src", "Algorithm", "Name", "Status", "Backend", "Qubits", "Shots", "Runtime", "Time", ""].map((h) => (
                    <th key={h} className="text-left py-2 px-2 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
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
                    <td className="py-1.5 px-2">
                      <button
                        title="Download raw JSON (QASM + results)"
                        onClick={() => downloadRow(r)}
                        className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition"
                      >
                        <Download size={12} />
                      </button>
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
