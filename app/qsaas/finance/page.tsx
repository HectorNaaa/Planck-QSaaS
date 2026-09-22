/**
 * app/qsaas/finance/page.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Finance Digital Twins — presets for Risk Scenario, Collateral & Liquidity
 * and Execution/RFQ, reusing the existing dashboard card/layout style.
 * All "Run demo" actions use small, reproducible synthetic snapshots and are
 * always labeled as such — never presented as real financial evidence.
 */
"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"

interface ModuleMeta {
  id: "risk-scenario" | "collateral-liquidity" | "execution-rfq"
  name: string
  description: string
  clientProfile: string
  demoScenario: Record<string, unknown>
}

const MODULES: ModuleMeta[] = [
  {
    id: "risk-scenario",
    name: "Risk Scenario Twin",
    description: "Portfolio VaR/CVaR via historical simulation and seeded Monte Carlo, benchmarked against a parametric-normal reference.",
    clientProfile: "Wealthtechs, digital asset managers and risk teams.",
    demoScenario: { horizonDays: 10, confidenceLevel: 0.95, method: "monte-carlo", numScenarios: 2000 },
  },
  {
    id: "collateral-liquidity",
    name: "Collateral & Liquidity Twin",
    description: "Minimum-cost funding/collateral allocation across accounts via an exact min-cost-flow solver.",
    clientProfile: "Multi-account treasuries, payments/FX fintechs and collateral desks.",
    demoScenario: { stressMultiplier: 1, annealingIterations: 4000, chunksPerObligation: 10 },
  },
  {
    id: "execution-rfq",
    name: "Execution / RFQ Twin",
    description: "Replay-based order allocation across venues, benchmarked against naive best-nominal-price routing.",
    clientProfile: "Brokers, FX platforms and trading fintechs comparing quotes/RFQs.",
    demoScenario: { decisionTime: "2026-09-19T12:00:30Z", annealingIterations: 3000, lotSize: 500 },
  },
]

type RunState = {
  loading: boolean
  error: string | null
  run: any | null
}

export default function FinanceTwinsPage() {
  const [state, setState] = useState<Record<string, RunState>>({})

  const runDemo = async (mod: ModuleMeta, executionMode: "classical" | "quantum-inspired") => {
    setState((prev) => ({ ...prev, [mod.id]: { loading: true, error: null, run: null } }))
    try {
      const res = await fetch(`/api/finance/${mod.id}/run`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useDemo: true, scenario: mod.demoScenario, executionMode }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setState((prev) => ({ ...prev, [mod.id]: { loading: false, error: data.error || `Request failed (${res.status})`, run: null } }))
        return
      }
      setState((prev) => ({ ...prev, [mod.id]: { loading: false, error: null, run: data.run } }))
    } catch (err) {
      setState((prev) => ({ ...prev, [mod.id]: { loading: false, error: err instanceof Error ? err.message : "Network error", run: null } }))
    }
  }

  return (
    <div className="p-8 space-y-8 px-0">
      <div className="space-y-1">
        <PageHeader title="Finance Digital Twins" description="Pilot financial presets built on the same digital twin engine — reproducible snapshots, classical baselines and honestly-labeled experimental routes." />
        <p className="text-xs text-muted-foreground px-0 mt-1">
          "Run demo" uses small, seeded synthetic data (never real portfolio/treasury/order data) so results are reproducible and clearly marked as such.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {MODULES.map((mod) => {
          const s = state[mod.id]
          return (
            <Card key={mod.id} className="p-6 flex flex-col gap-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">{mod.name}</h3>
                <p className="text-xs text-primary/80 font-medium mt-0.5">{mod.clientProfile}</p>
                <p className="text-sm text-muted-foreground mt-2">{mod.description}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={s?.loading} onClick={() => runDemo(mod, "classical")}>
                  {s?.loading ? "Running…" : "Run classical baseline (demo)"}
                </Button>
                <Button size="sm" variant="outline" disabled={s?.loading} onClick={() => runDemo(mod, "quantum-inspired")}>
                  Run quantum-inspired (demo)
                </Button>
              </div>

              {s?.error && (
                <p className="text-xs text-destructive">{s.error}</p>
              )}

              {s?.run && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-xs">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{s.run.executionMode}</span>
                    <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">{s.run.solverActual}</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium">
                      {s.run.isSynthetic ? "synthetic demo data" : "user data"}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full font-medium ${s.run.status === "completed" ? "bg-green-500/10 text-green-600" : "bg-orange-500/10 text-orange-600"}`}>
                      {s.run.status}
                    </span>
                  </div>
                  {s.run.capability && (
                    <p className="text-muted-foreground italic">Experimental route unavailable: {s.run.capability.reason}</p>
                  )}
                  <pre className="overflow-x-auto whitespace-pre-wrap break-all text-[11px] leading-snug">
                    {JSON.stringify(s.run.kpis, null, 2)}
                  </pre>
                  {s.run.warnings?.length > 0 && (
                    <ul className="list-disc list-inside text-muted-foreground">
                      {s.run.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
