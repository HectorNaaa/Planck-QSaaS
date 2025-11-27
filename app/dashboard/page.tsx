import { MainLayout } from "@/components/layout/main-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart3, Zap, TrendingUp, Clock } from "lucide-react"
import Link from "next/link"

export default function DashboardPage() {
  const stats = [
    { label: "Circuits Run", value: "2,847", change: "+12%", icon: Zap },
    { label: "Success Rate", value: "98.2%", change: "+0.5%", icon: TrendingUp },
    { label: "Avg Runtime", value: "124ms", change: "-15%", icon: Clock },
    { label: "Total Qubits", value: "15,040", change: "+200", icon: BarChart3 },
  ]

  const recentCircuits = [
    { id: 1, name: "Grover's Algorithm", status: "success", qubits: 8, runtime: "156ms" },
    { id: 2, name: "Shor's Algorithm", status: "success", qubits: 16, runtime: "234ms" },
    { id: 3, name: "VQE Optimization", status: "running", qubits: 12, runtime: "89ms" },
  ]

  return (
    <MainLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your quantum computing activity.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => {
            const Icon = stat.icon
            return (
              <Card key={i} className="p-6">
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
        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-foreground">Recent Circuits</h2>
            <Link href="/runner">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <h3 className="text-lg font-bold text-foreground mb-3">Start a New Circuit</h3>
            <p className="text-muted-foreground mb-4">Build and run your own quantum circuits from scratch.</p>
            <Link href="/runner">
              <Button variant="outline" className="w-full bg-transparent">
                Open Runner
              </Button>
            </Link>
          </Card>
          <Card className="p-6 bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
            <h3 className="text-lg font-bold text-foreground mb-3">Browse Templates</h3>
            <p className="text-muted-foreground mb-4">Use pre-built quantum algorithms as a starting point.</p>
            <Link href="/templates">
              <Button variant="outline" className="w-full bg-transparent">
                View Templates
              </Button>
            </Link>
          </Card>
          <Card className="p-6 bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20">
            <h3 className="text-lg font-bold text-foreground mb-3">Documentation</h3>
            <p className="text-muted-foreground mb-4">Learn quantum computing concepts and best practices.</p>
            <Button variant="outline" className="w-full bg-transparent">
              Read Docs
            </Button>
          </Card>
        </div>
      </div>
    </MainLayout>
  )
}
