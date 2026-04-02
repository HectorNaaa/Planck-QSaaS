/**
 * app/qsaas/dashboard/page.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * QSaaS Digital Twin Dashboard.
 *
 * Layout:
 *   • 4 summary stat cards
 *   • Tab bar: "All" + one tab per digital twin
 *   • Each tab renders a <DigitalTwinDashboard> with 3 live charts + runs table
 *
 * Live updates strategy:
 *   • SSE streams provide real-time execution updates
 *   • When the user enables SDK-mode in the runner the SSE hook inside
 *     DigitalTwinDashboard appends rows in real-time without any page reload
 */

"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BarChart3, Zap, TrendingUp, Clock, Radio } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/page-header"
import { useEffect, useState, useMemo } from "react"
import { DigitalTwinDashboard } from "@/components/dashboard/digital-twin-dashboard"
import type { ExecutionRow } from "@/hooks/use-live-executions"

type TimeRange = "24h" | "7d" | "30d"

interface DigitalTwin {
  id: string
  name: string
  description: string | null
  image_url: string | null
}

interface DashboardStats {
  totalRuns: number
  avgSuccessRate: number
  avgRuntime: number
  avgQubits: number
}

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d")
  const [allRows, setAllRows] = useState<ExecutionRow[]>([])
  const [twins, setTwins] = useState<DigitalTwin[]>([])
  const [activeTab, setActiveTab] = useState<"all" | string>("all")
  const [loading, setLoading] = useState(true)
  const [liveEnabled, setLiveEnabled] = useState(false)

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => { loadAll() }, [timeRange])

  async function loadAll() {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard/data?timeRange=${timeRange}`)
      const data = await res.json()
      
      setAllRows(data.logs || [])
      setTwins(data.twins || [])
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo<DashboardStats>(() => {
    const done = allRows.filter((r) => r.status === "completed" || r.status === "saved")
    const n = done.length
    if (n === 0) return { totalRuns: 0, avgSuccessRate: 0, avgRuntime: 0, avgQubits: 0 }
    const success = done.filter((r) => r.status === "completed").length
    return {
      totalRuns: n,
      avgSuccessRate: Math.round((success / n) * 1000) / 10,
      avgRuntime: Math.round(done.reduce((s, r) => s + (r.runtime_ms || 0), 0) / n),
      avgQubits: Math.round(done.reduce((s, r) => s + (r.qubits_used || 0), 0) / n),
    }
  }, [allRows])

  // ── Per-DT rows ────────────────────────────────────────────────────────────
  const rowsForTab = useMemo<ExecutionRow[]>(() => {
    if (activeTab === "all") return allRows
    return allRows.filter((r) => r.digital_twin_id === activeTab)
  }, [allRows, activeTab])

  const activeTwin = twins.find((t) => t.id === activeTab) ?? null

  const statCards = [
    { label: "Total Runs", value: loading ? "…" : stats.totalRuns.toString(), icon: Zap },
    { label: "Avg Success Rate", value: loading ? "…" : `${stats.avgSuccessRate}%`, icon: TrendingUp },
    { label: "Avg Runtime", value: loading ? "…" : `${stats.avgRuntime}ms`, icon: Clock },
    { label: "Avg Qubits", value: loading ? "…" : stats.avgQubits.toString(), icon: BarChart3 },
  ]

  return (
    <div className="p-8 space-y-8 px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title="Digital Twin Dashboard" description="Live quantum execution activity across all your digital twins." />
        <div className="flex items-center gap-3 flex-wrap">
          {/* Live-mode toggle */}
          <button
            role="switch"
            aria-checked={liveEnabled}
            onClick={() => {
              const next = !liveEnabled
              setLiveEnabled(next)
              sessionStorage.setItem("planck_sdk_mode", next ? "1" : "0")
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
              liveEnabled
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Radio size={13} className={liveEnabled ? "text-primary" : "text-muted-foreground"} />
            {liveEnabled ? "Live" : "Live off"}
          </button>
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-36 shadow">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map(({ label, value, icon: Icon }, i) => (
          <Card key={i} className="p-5 hover:shadow-lg hover:scale-[1.02] transition-all duration-200 shadow">
            <div className="flex items-center justify-between mb-3">
              <p className="text-muted-foreground text-sm font-medium">{label}</p>
              <Icon className="text-primary" size={22} />
            </div>
            <p className="text-3xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-primary mt-1">Last {timeRange}</p>
          </Card>
        ))}
      </div>

      {/* Tab bar: All + one per DT */}
      <div className="flex items-center gap-1 flex-wrap">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === "all"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          }`}
        >
          All
        </button>
        {twins.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === t.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {t.image_url && (
              <img src={t.image_url} alt="" className="w-4 h-4 rounded-full object-cover" />
            )}
            {t.name}
            <span className="text-[10px] opacity-70">
              {allRows.filter((r) => r.digital_twin_id === t.id).length}
            </span>
          </button>
        ))}
        <Link href="/qsaas/runner">
          <Button size="sm" className="ml-auto bg-primary hover:bg-primary/90 text-xs">
            + New Digital Twin
          </Button>
        </Link>
      </div>

      {/* Active tab content */}
      {loading ? (
        <p className="text-muted-foreground text-sm py-12 text-center">Loading…</p>
      ) : (
        <DigitalTwinDashboard
          key={activeTab}
          initialRows={rowsForTab}
          liveEnabled={liveEnabled}
          apiKey={userApiKey}
          digitalTwinId={activeTab === "all" ? null : activeTab}
          title={activeTab === "all" ? "All Digital Twins" : (activeTwin?.name ?? activeTab)}
          timeRange={timeRange}
        />
      )}
    </div>
  )
}
