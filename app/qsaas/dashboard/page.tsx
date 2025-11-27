import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart3, Zap, TrendingUp, Clock } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/page-header"

export default function DashboardPage() {
  const stats = [
    { label: "Circuits Run", value: "2,847", change: "+12%", icon: Zap },
    { label: "Success Rate", value: "98.2%", change: "+0.5%", icon: TrendingUp },
    { label: "Avg Runtime", value: "124ms", change: "-15%", icon: Clock },
    { label: "Total Qubits", value: "15,040", change: "+200", icon: BarChart3 },
  ]

  const recentCircuits = [
    {
      id: 1,
      name: "Grover's Algorithm",
      status: "success",
      qubits: 8,
      runtime: "156ms",
      timestamp: "2025-01-20 14:32",
    },
    { id: 2, name: "Shor's Algorithm", status: "success", qubits: 16, runtime: "234ms", timestamp: "2025-01-20 13:15" },
    { id: 3, name: "VQE Optimization", status: "running", qubits: 12, runtime: "89ms", timestamp: "2025-01-20 12:48" },
  ]

  return (
    <div className="p-8 space-y-8 px-4">
      {/* Header */}
      <PageHeader title="Dashboard" description="Welcome back! Here's your quantum computing activity." />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => {
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
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Circuit Name</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Qubits</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Runtime</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {recentCircuits.map((circuit) => (
                <tr key={circuit.id} className="border-b border-border hover:bg-secondary/50 transition">
                  <td className="py-3 px-4 font-medium text-foreground">{circuit.name}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        circuit.status === "success" ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent"
                      }`}
                    >
                      {circuit.status === "success" ? "✓ Success" : "◀ Running"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-foreground">{circuit.qubits}</td>
                  <td className="py-3 px-4 text-foreground">{circuit.runtime}</td>
                  <td className="py-3 px-4 text-muted-foreground text-sm">{circuit.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Quick Links */}
    </div>
  )
}
