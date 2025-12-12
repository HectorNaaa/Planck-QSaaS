"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BarChart3, Zap, TrendingUp, Clock, Download } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/page-header"
import { useEffect, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"

type TimeRange = "24h" | "7d" | "30d"

interface DashboardStats {
  avgCircuitsRun: number
  avgSuccessRate: number
  avgRuntime: number
  avgQubits: number
}

interface RecentCircuit {
  id: string
  circuit_name: string
  status: string
  qubits_used: number
  runtime_ms: number
  created_at: string
}

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d")
  const [stats, setStats] = useState<DashboardStats>({
    avgCircuitsRun: 0,
    avgSuccessRate: 0,
    avgRuntime: 0,
    avgQubits: 0,
  })
  const [recentCircuits, setRecentCircuits] = useState<RecentCircuit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [timeRange])

  async function loadDashboardData() {
    setLoading(true)
    const supabase = createBrowserClient()

    try {
      const cachedCircuits = sessionStorage.getItem("planck_recent_circuits")
      if (cachedCircuits && timeRange === "7d") {
        const circuits = JSON.parse(cachedCircuits)
        setRecentCircuits(circuits.slice(0, 5))
        calculateStats(circuits)
      }

      const now = new Date()
      const timeThreshold = new Date()
      switch (timeRange) {
        case "24h":
          timeThreshold.setHours(now.getHours() - 24)
          break
        case "7d":
          timeThreshold.setDate(now.getDate() - 7)
          break
        case "30d":
          timeThreshold.setDate(now.getDate() - 30)
          break
      }

      const { data: logs, error } = await supabase
        .from("execution_logs")
        .select("*")
        .gte("created_at", timeThreshold.toISOString())
        .order("created_at", { ascending: false })

      if (error) {
        console.error("[v0] Error fetching dashboard data:", error)
        return
      }

      if (logs && logs.length > 0) {
        calculateStats(logs)
        setRecentCircuits(logs.slice(0, 5) as RecentCircuit[])

        if (timeRange === "7d") {
          sessionStorage.setItem("planck_recent_circuits", JSON.stringify(logs.slice(0, 10)))
        }
      } else {
        setStats({
          avgCircuitsRun: 0,
          avgSuccessRate: 0,
          avgRuntime: 0,
          avgQubits: 0,
        })
        setRecentCircuits([])
      }
    } catch (error) {
      console.error("[v0] Error loading dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  function calculateStats(logs: any[]) {
    const completedOrSavedLogs = logs.filter((log) => log.status === "completed" || log.status === "saved")

    const totalCircuits = completedOrSavedLogs.length
    const successfulCircuits = completedOrSavedLogs.filter((log) => log.status === "completed").length
    const avgSuccessRate = totalCircuits > 0 ? (successfulCircuits / totalCircuits) * 100 : 0

    const totalRuntime = completedOrSavedLogs.reduce((sum, log) => sum + (log.runtime_ms || 0), 0)
    const avgRuntime = totalCircuits > 0 ? totalRuntime / totalCircuits : 0

    const totalQubits = completedOrSavedLogs.reduce((sum, log) => sum + (log.qubits_used || 0), 0)
    const avgQubits = totalCircuits > 0 ? totalQubits / totalCircuits : 0

    setStats({
      avgCircuitsRun: totalCircuits,
      avgSuccessRate: Math.round(avgSuccessRate * 10) / 10,
      avgRuntime: Math.round(avgRuntime),
      avgQubits: Math.round(avgQubits * 10) / 10,
    })
  }

  const handleDownloadCircuitJson = async (circuitId: string) => {
    const supabase = createBrowserClient()

    try {
      const { data, error } = await supabase.from("execution_logs").select("*").eq("id", circuitId).single()

      if (error) throw error

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${data.circuit_name}_${circuitId}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("[v0] Error downloading circuit JSON:", error)
    }
  }

  const statCards = [
    {
      label: "Avg Circuits Run",
      value: loading ? "..." : stats.avgCircuitsRun.toString(),
      change: `Last ${timeRange}`,
      icon: Zap,
    },
    {
      label: "Avg Success Rate",
      value: loading ? "..." : `${stats.avgSuccessRate}%`,
      change: `Last ${timeRange}`,
      icon: TrendingUp,
    },
    {
      label: "Avg Runtime",
      value: loading ? "..." : `${stats.avgRuntime}ms`,
      change: `Last ${timeRange}`,
      icon: Clock,
    },
    {
      label: "Avg Qubits",
      value: loading ? "..." : stats.avgQubits.toFixed(1),
      change: `Last ${timeRange}`,
      icon: BarChart3,
    },
  ]

  return (
    <div className="p-8 space-y-8 px-0">
      {/* Header with Time Range Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title="Dashboard" description="Welcome back! Here's your quantum computing activity." />
        <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
          <SelectTrigger className="w-[180px] shadow-lg">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 Hours</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => {
          const Icon = stat.icon
          return (
            <Card key={i} className="p-6 hover:shadow-lg hover:scale-105 transition-all duration-300 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <p className="text-muted-foreground text-sm font-medium">{stat.label}</p>
                <Icon className="text-primary" size={24} />
              </div>
              <p className="text-3xl font-bold text-foreground mb-2">{stat.value}</p>
              <p className="text-sm text-primary">{stat.change}</p>
            </Card>
          )
        })}
      </div>

      {/* Recent Activity */}
      <Card className="p-6 hover:shadow-lg transition-all duration-300 shadow-lg bg-secondary">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-foreground">Recent Circuits</h2>
          <Link href="/qsaas/runner">
            <Button className="bg-primary hover:bg-primary/90">New Circuit</Button>
          </Link>
        </div>
        {loading ? (
          <p className="text-muted-foreground text-center py-8">Loading recent circuits...</p>
        ) : recentCircuits.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No circuits run in this time period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Circuit Name</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Qubits</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Runtime</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Timestamp</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentCircuits.map((circuit) => (
                  <tr key={circuit.id} className="border-b border-border hover:bg-secondary/50 transition">
                    <td className="py-3 px-4 font-medium text-foreground">{circuit.circuit_name}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                          circuit.status === "completed"
                            ? "bg-primary/20 text-primary"
                            : circuit.status === "running"
                              ? "bg-accent/20 text-accent"
                              : "bg-destructive/20 text-destructive"
                        }`}
                      >
                        {circuit.status === "completed"
                          ? "✓ Success"
                          : circuit.status === "running"
                            ? "◀ Running"
                            : "✗ Failed"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-foreground">{circuit.qubits_used}</td>
                    <td className="py-3 px-4 text-foreground">{circuit.runtime_ms}ms</td>
                    <td className="py-3 px-4 text-muted-foreground text-sm">
                      {new Date(circuit.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <Button
                        onClick={() => handleDownloadCircuitJson(circuit.id)}
                        size="sm"
                        variant="ghost"
                        className="flex items-center gap-1"
                      >
                        <Download size={16} />
                        JSON
                      </Button>
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
