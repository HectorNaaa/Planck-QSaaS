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
import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { DigitalTwinDashboard } from "@/components/dashboard/digital-twin-dashboard"
import { useLiveExecutions, type ExecutionRow } from "@/hooks/use-live-executions"
import { useIsGuest } from "@/components/guest-banner"
import { useLiveMode } from "@/hooks/use-live-mode"
import { useRef } from "react"

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

// ── Execution cache helpers ────────────────────────────────────────────────
// SQLite on Vercel is stored in /tmp (set via vercel.json DB_DIR), which is
// ephemeral: it's wiped on every cold start.  These helpers use localStorage
// as a persistent fallback so authenticated users keep their history across
// server restarts without requiring an external database.
const EXEC_CACHE_KEY = "planck_exec_cache"

function readExecCache(): ExecutionRow[] {
  try {
    const raw = localStorage.getItem(EXEC_CACHE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ExecutionRow[]
  } catch {
    return []
  }
}

function writeExecCache(rows: ExecutionRow[]) {
  try {
    localStorage.setItem(EXEC_CACHE_KEY, JSON.stringify(rows.slice(0, 500)))
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

function mergeExecRows(serverRows: ExecutionRow[], cachedRows: ExecutionRow[]): ExecutionRow[] {
  const serverIds = new Set(serverRows.map((r) => r.id))
  const extra = cachedRows.filter((r) => !serverIds.has(r.id))
  const merged = [...serverRows, ...extra]
  merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return merged
}

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d")
  const [allRows, setAllRows] = useState<ExecutionRow[]>([])
  const [twins, setTwins] = useState<DigitalTwin[]>([])
  const [activeTab, setActiveTab] = useState<"all" | string>("all")
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const isGuest = useIsGuest()
  // Shared live mode — synced with runner via sessionStorage + BroadcastChannel
  const [liveEnabled, setLiveEnabled] = useLiveMode(isGuest)

  // Flash animation for stat cards when values change
  const [flashStats, setFlashStats] = useState(false)
  const prevStatsRef = useRef<DashboardStats | null>(null)

  // Storage warning: read localStorage cache size on mount
  const STORAGE_CAP_BYTES = 10 * 1024 * 1024
  const [storageUsedBytes, setStorageUsedBytes] = useState(0)
  useEffect(() => {
    if (isGuest) return
    try {
      const raw = localStorage.getItem(EXEC_CACHE_KEY)
      if (!raw) return
      const rows = JSON.parse(raw) as ExecutionRow[]
      const total = rows.reduce((sum, r) => sum + JSON.stringify(r).length, 0)
      setStorageUsedBytes(total)
    } catch { /* non-fatal */ }
  }, [isGuest])

  // Page-level SSE feed — drives stat cards and tab counts in real time.
  // The embedded <DigitalTwinDashboard> uses liveEnabled=false and receives
  // real-time rows via the initialRows prop (rowsForTab) instead, keeping
  // only one SSE connection open per page.
  const { rows: sseRows } = useLiveExecutions({ enabled: liveEnabled && !isGuest })

  // Append a single execution row to allRows + cache without a full refetch.
  // Used by the BroadcastChannel listener so UI runs from runner appear instantly.
  const appendExecRow = useCallback((row: ExecutionRow) => {
    setAllRows((prev) => {
      if (prev.some((r) => r.id === row.id)) return prev
      const next = [row, ...prev]
      next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      // Also update localStorage cache
      writeExecCache(next)
      return next
    })
  }, [])

  // Sync SSE rows (from page-level hook) into allRows so stat cards and tab
  // counts stay up-to-date. appendExecRow deduplicates by ID.
  useEffect(() => {
    sseRows.forEach((row) => appendExecRow(row))
  }, [sseRows, appendExecRow])

  // BroadcastChannel listener removed — the useLiveExecutions hook's own
  // always-active BC listener already captures execution_completed broadcasts
  // into sseRows, which the sync effect above feeds into allRows.

  const loadAllRef = useRef<() => void>(() => {})

  useEffect(() => { loadAll() }, [timeRange, isGuest])

  // Re-fetch when the browser tab becomes visible again (user switches back)
  // or when liveEnabled is toggled — ensures stat cards are always fresh.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") loadAllRef.current() }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [])

  useEffect(() => { if (liveEnabled && !isGuest) loadAllRef.current() }, [liveEnabled, isGuest])

  // Periodic fallback re-fetch every 10 s while live mode is on.
  // Covers the case where SSE is connected to a different Vercel function
  // instance than the one handling SDK writes.
  useEffect(() => {
    if (!liveEnabled || isGuest) return
    const id = setInterval(() => loadAllRef.current(), 10_000)
    return () => clearInterval(id)
  }, [liveEnabled, isGuest])

  async function loadAll() {
    setLoading(true)
    try {
      // Guests get empty dashboard — no API call needed
      if (isGuest) {
        setAllRows([])
        setTwins([])
        setLoading(false)
        return
      }
      const res = await fetch(`/api/dashboard/data?timeRange=${timeRange}`)
      if (res.status === 401) {
        router.push('/auth/login')
        return
      }
      const data = await res.json()
      const serverRows: ExecutionRow[] = data.logs || []

      // Merge with localStorage cache to survive Vercel cold-start DB wipes.
      // Server rows take priority for IDs that exist in both; cache fills in
      // rows that the server lost after a cold start.
      const cachedRows = readExecCache()
      const merged = mergeExecRows(serverRows, cachedRows)
      writeExecCache(merged)

      // Use a functional updater so we never blow away SSE rows that arrived
      // between the fetch start and its resolution.
      setAllRows((prev) => {
        const ids = new Set(merged.map((r) => r.id))
        const extra = prev.filter((r) => !ids.has(r.id))
        if (extra.length === 0) return merged
        const combined = [...merged, ...extra]
        combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        return combined
      })
      setTwins(data.twins || [])
    } catch (error) {
      console.error('[DASHBOARD] Error loading dashboard data:', error)
      // Show cached data when server fetch fails
      const cachedRows = readExecCache()
      if (cachedRows.length > 0) {
        console.log('[DASHBOARD] Showing', cachedRows.length, 'cached executions after fetch error')
        setAllRows(cachedRows)
      }
    } finally {
      setLoading(false)
    }
  }
  // Keep ref in sync so visibility/periodic callbacks call the latest closure.
  loadAllRef.current = loadAll

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

  // Trigger flash animation when stat values actually change
  useEffect(() => {
    if (loading) return
    const prev = prevStatsRef.current
    prevStatsRef.current = stats
    if (
      prev !== null &&
      (prev.totalRuns !== stats.totalRuns ||
        prev.avgSuccessRate !== stats.avgSuccessRate ||
        prev.avgRuntime !== stats.avgRuntime ||
        prev.avgQubits !== stats.avgQubits)
    ) {
      setFlashStats(true)
      const t = setTimeout(() => setFlashStats(false), 250)
      return () => clearTimeout(t)
    }
  }, [stats, loading])

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
            onClick={() => setLiveEnabled(!liveEnabled)}
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

      {/* Storage limit warning banner */}
      {!isGuest && storageUsedBytes >= STORAGE_CAP_BYTES && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-destructive/60 bg-destructive/10 text-sm">
          <span className="text-destructive font-bold mt-0.5">⚠</span>
          <div>
            <p className="font-semibold text-destructive">Execution history storage limit reached ({(storageUsedBytes / 1_048_576).toFixed(1)} MB / 10 MB)</p>
            <p className="text-destructive/80 text-xs mt-0.5">New executions are blocked. Go to <strong>Settings → Execution History &amp; Storage</strong> and delete some records to free space.</p>
          </div>
        </div>
      )}
      {!isGuest && storageUsedBytes >= STORAGE_CAP_BYTES * 0.8 && storageUsedBytes < STORAGE_CAP_BYTES && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10 text-sm">
          <span className="text-yellow-600 dark:text-yellow-400 font-bold mt-0.5">⚠</span>
          <div>
            <p className="font-semibold text-yellow-700 dark:text-yellow-300">Execution history storage is almost full ({(storageUsedBytes / 1_048_576).toFixed(1)} MB / 10 MB)</p>
            <p className="text-yellow-600/80 dark:text-yellow-400/80 text-xs mt-0.5">Go to <strong>Settings → Execution History &amp; Storage</strong> to free space before your limit is reached.</p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map(({ label, value, icon: Icon }, i) => (
          <Card key={i} className="p-5 hover:shadow-lg hover:scale-[1.02] transition-all duration-200 shadow">
            <div className="flex items-center justify-between mb-3">
              <p className="text-muted-foreground text-sm font-medium">{label}</p>
              <Icon className="text-primary" size={22} />
            </div>
            <p className={`text-3xl font-bold text-foreground ${flashStats ? "stat-value-flash" : ""}`}>{value}</p>
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
          liveEnabled={false}
          apiKey={null}
          digitalTwinId={activeTab === "all" ? null : activeTab}
          title={activeTab === "all" ? "All Digital Twins" : (activeTwin?.name ?? activeTab)}
          timeRange={timeRange}
        />
      )}
    </div>
  )
}
