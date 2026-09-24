/**
 * app/qsaas/templates/page.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Digital Twin Templates — catalog of reusable twin *definitions*:
 *   1. Built-in Finance Presets (Risk Scenario, Collateral & Liquidity,
 *      Execution/RFQ) — tagged "finance"; more verticals can register here
 *      later without adding another tab.
 *   2. My Twins — the user's own saved, reusable, re-runnable instances.
 *      Private by default; can be explicitly published as a community preset.
 *   3. Community Presets — twins other users have published. Only the
 *      definition (name/description/tags/config) is ever shared — never
 *      snapshots, run results, or any private data.
 *
 * This replaces the old algorithm-gallery "Model Templates" tab. There is no
 * separate Bell/Grover/QAOA/VQE showcase here — those remain an internal
 * "advanced option" of the Simulator, not a public catalog.
 */
"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { Plus, Globe2, Lock, Copy, Trash2, X } from "lucide-react"
import { useUIPreferences } from "@/contexts/ui-preferences-context"

type FinanceModuleId = "risk-scenario" | "collateral-liquidity" | "execution-rfq"

interface ModuleMeta {
  id: FinanceModuleId
  name: string
  description: string
  clientProfile: string
  demoScenario: Record<string, unknown>
}

const BUILTIN_MODULES: ModuleMeta[] = [
  {
    id: "risk-scenario",
    name: "Risk Scenario Twin",
    description: "Portfolio VaR/CVaR via historical simulation and seeded Monte Carlo, benchmarked against a parametric-normal reference.",
    clientProfile: "Wealthtechs, digital asset managers and risk teams.",
    demoScenario: { horizonDays: 10, confidenceLevel: 0.95, method: "historical", numScenarios: 2000 },
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

interface Twin {
  id: string
  userId: string
  moduleId: FinanceModuleId
  name: string
  description: string | null
  tags: string[]
  config: { scenario?: Record<string, unknown> } | null
  visibility: "private" | "public"
  kind: "ephemeral" | "user_defined"
  sourceTwinId: string | null
  createdAt: string
}

type RunState = { loading: boolean; error: string | null; run: any | null }

function moduleName(id: FinanceModuleId) {
  return BUILTIN_MODULES.find((m) => m.id === id)?.name ?? id
}

export default function TemplatesPage() {
  const { isHidden } = useUIPreferences()
  const [runState, setRunState] = useState<Record<string, RunState>>({})
  const [myTwins, setMyTwins] = useState<Twin[]>([])
  const [communityTwins, setCommunityTwins] = useState<Twin[]>([])
  const [loadingTwins, setLoadingTwins] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [prefillModule, setPrefillModule] = useState<FinanceModuleId>("risk-scenario")
  const [prefillScenario, setPrefillScenario] = useState<Record<string, unknown> | null>(null)

  const loadTwins = async () => {
    setLoadingTwins(true)
    try {
      const [mineRes, publicRes] = await Promise.all([
        fetch("/api/twins?scope=mine", { credentials: "include" }),
        fetch("/api/twins?scope=public&tag=finance", { credentials: "include" }),
      ])
      const mine = await mineRes.json()
      const pub = await publicRes.json()
      if (mine.success) setMyTwins(mine.twins)
      if (pub.success) setCommunityTwins(pub.twins)
    } catch {
      // Non-fatal — the built-in presets still render.
    } finally {
      setLoadingTwins(false)
    }
  }

  useEffect(() => {
    loadTwins()
  }, [])

  const runDemo = async (
    key: string,
    moduleId: FinanceModuleId,
    scenario: Record<string, unknown>,
    computeMode: "classical" | "quantum-inspired",
    twinId?: string,
  ) => {
    setRunState((prev) => ({ ...prev, [key]: { loading: true, error: null, run: null } }))
    try {
      const res = await fetch(`/api/finance/${moduleId}/run`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useDemo: true, scenario, computeMode, twinId }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setRunState((prev) => ({ ...prev, [key]: { loading: false, error: data.error || `Request failed (${res.status})`, run: null } }))
        return
      }
      setRunState((prev) => ({ ...prev, [key]: { loading: false, error: null, run: data.run } }))
    } catch (err) {
      setRunState((prev) => ({ ...prev, [key]: { loading: false, error: err instanceof Error ? err.message : "Network error", run: null } }))
    }
  }

  const publishTwin = async (twin: Twin, visibility: "private" | "public") => {
    const res = await fetch(`/api/twins/${twin.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility }),
    })
    if (res.ok) loadTwins()
  }

  const deleteTwin = async (twin: Twin) => {
    if (!confirm(`Delete twin "${twin.name}"? This cannot be undone.`)) return
    const res = await fetch(`/api/twins/${twin.id}`, { method: "DELETE", credentials: "include" })
    if (res.ok) loadTwins()
  }

  const duplicateTwin = async (twin: Twin) => {
    const res = await fetch(`/api/twins/${twin.id}/duplicate`, { method: "POST", credentials: "include" })
    if (res.ok) loadTwins()
  }

  const openCreateFor = (moduleId: FinanceModuleId, scenario: Record<string, unknown>) => {
    setPrefillModule(moduleId)
    setPrefillScenario(scenario)
    setShowCreate(true)
  }

  return (
    <div className="p-8 space-y-10 px-0">
      <div className="space-y-1 flex items-start justify-between flex-wrap gap-4">
        <div>
          <PageHeader title="Digital Twin Templates" description="Reusable twin definitions — start from a preset or create your own." />
          <p className="text-xs text-muted-foreground px-0 mt-1">
            All presets here are tagged <span className="font-medium text-primary">finance</span> for now — more verticals can register without a new tab.
          </p>
        </div>
        <Button onClick={() => openCreateFor("risk-scenario", {})} className="flex items-center gap-2">
          <Plus size={16} /> Create my twin
        </Button>
      </div>

      {/* ── Built-in finance presets ───────────────────────────────────────── */}
      {!isHidden('templates.finance_presets') && (
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">Finance Presets</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {BUILTIN_MODULES.map((mod) => {
            const s = runState[mod.id]
            return (
              <Card key={mod.id} className="p-6 flex flex-col gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-foreground">{mod.name}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">finance</span>
                  </div>
                  <p className="text-xs text-primary/80 font-medium mt-0.5">{mod.clientProfile}</p>
                  <p className="text-sm text-muted-foreground mt-2">{mod.description}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={s?.loading} onClick={() => runDemo(mod.id, mod.id, mod.demoScenario, "classical")}>
                    {s?.loading ? "Running…" : "Run demo (classical)"}
                  </Button>
                  <Button size="sm" variant="outline" disabled={s?.loading} onClick={() => runDemo(mod.id, mod.id, mod.demoScenario, "quantum-inspired")}>
                    Run demo (quantum-inspired)
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openCreateFor(mod.id, mod.demoScenario)}>
                    Use as my twin
                  </Button>
                </div>

                <RunResult state={s} />
              </Card>
            )
          })}
        </div>
      </section>
      )}

      {/* ── My twins ───────────────────────────────────────────────────────── */}
      {!isHidden('templates.my_twins') && (
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">My Twins</h2>
        {loadingTwins ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : myTwins.length === 0 ? (
          <p className="text-sm text-muted-foreground">No saved twins yet — duplicate a preset above or click "Create my twin".</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {myTwins.map((twin) => {
              const s = runState[twin.id]
              return (
                <Card key={twin.id} className="p-6 flex flex-col gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-foreground">{twin.name}</h3>
                      {twin.tags.map((t) => (
                        <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">{t}</span>
                      ))}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1 ${twin.visibility === "public" ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}>
                        {twin.visibility === "public" ? <Globe2 size={10} /> : <Lock size={10} />}
                        {twin.visibility}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{moduleName(twin.moduleId)}</p>
                    {twin.description && <p className="text-sm text-muted-foreground mt-2">{twin.description}</p>}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={s?.loading}
                      onClick={() =>
                        runDemo(
                          twin.id,
                          twin.moduleId,
                          twin.config?.scenario ?? BUILTIN_MODULES.find((m) => m.id === twin.moduleId)?.demoScenario ?? {},
                          "classical",
                          twin.id,
                        )
                      }
                    >
                      {s?.loading ? "Running…" : "Run demo"}
                    </Button>
                    {twin.visibility === "private" ? (
                      <Button size="sm" variant="outline" onClick={() => publishTwin(twin, "public")}>Publish</Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => publishTwin(twin, "private")}>Unpublish</Button>
                    )}
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => deleteTwin(twin)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>

                  <RunResult state={s} />
                </Card>
              )
            })}
          </div>
        )}
      </section>
      )}

      {/* ── Community presets ──────────────────────────────────────────────── */}
      {!isHidden('templates.community') && (
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">Community Presets</h2>
        {communityTwins.length === 0 ? (
          <p className="text-sm text-muted-foreground">No community-published finance twins yet.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {communityTwins.map((twin) => (
              <Card key={twin.id} className="p-6 flex flex-col gap-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{twin.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{moduleName(twin.moduleId)}</p>
                  {twin.description && <p className="text-sm text-muted-foreground mt-2">{twin.description}</p>}
                </div>
                <Button size="sm" variant="outline" className="flex items-center gap-2 w-fit" onClick={() => duplicateTwin(twin)}>
                  <Copy size={14} /> Duplicate to my twins
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>
      )}

      {showCreate && (
        <CreateTwinModal
          defaultModuleId={prefillModule}
          defaultScenario={prefillScenario}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            loadTwins()
          }}
        />
      )}
    </div>
  )
}

function RunResult({ state: s }: { state: RunState | undefined }) {
  if (!s) return null
  return (
    <>
      {s.error && <p className="text-xs text-destructive">{s.error}</p>}
      {s.run && (
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
    </>
  )
}

function CreateTwinModal({
  defaultModuleId,
  defaultScenario,
  onClose,
  onCreated,
}: {
  defaultModuleId: FinanceModuleId
  defaultScenario: Record<string, unknown> | null
  onClose: () => void
  onCreated: () => void
}) {
  const [moduleId, setModuleId] = useState<FinanceModuleId>(defaultModuleId)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [visibility, setVisibility] = useState<"private" | "public">("private")
  const [scenarioText, setScenarioText] = useState(JSON.stringify(defaultScenario ?? {}, null, 2))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setError(null)
    if (!name.trim()) {
      setError("Name is required")
      return
    }
    let scenario: Record<string, unknown> = {}
    try {
      scenario = scenarioText.trim() ? JSON.parse(scenarioText) : {}
    } catch {
      setError("Default scenario must be valid JSON")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/twins", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          name: name.trim(),
          description: description.trim() || null,
          tags: ["finance"],
          config: { scenario },
          visibility,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to create twin")
        return
      }
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <Card className="w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">Create my twin</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Base preset</label>
          <select
            value={moduleId}
            onChange={(e) => setModuleId(e.target.value as FinanceModuleId)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
          >
            {BUILTIN_MODULES.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q3 Portfolio Stress Twin"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Tags</label>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">finance</span>
            <span className="text-xs text-muted-foreground">More verticals coming soon.</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Default scenario (JSON)</label>
          <textarea
            value={scenarioText}
            onChange={(e) => setScenarioText(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground font-mono text-xs"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Visibility</label>
          <div className="flex gap-2">
            <button
              onClick={() => setVisibility("private")}
              className={`flex-1 py-2 px-3 rounded-lg font-medium transition ${visibility === "private" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}
            >
              Private (default)
            </button>
            <button
              onClick={() => setVisibility("public")}
              className={`flex-1 py-2 px-3 rounded-lg font-medium transition ${visibility === "public" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}
            >
              Publish now
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Only this definition (name/description/tags/default scenario) would be shared — never your data, snapshots or run results.
          </p>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={saving} onClick={submit}>{saving ? "Saving…" : "Create twin"}</Button>
        </div>
      </Card>
    </div>
  )
}

