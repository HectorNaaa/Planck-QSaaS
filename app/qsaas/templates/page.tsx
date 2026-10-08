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
  // Inline "Open in Runner" — editable scenario + run, reusing the same twinId for every run.
  const [openRunner, setOpenRunner] = useState<Record<string, boolean>>({})
  const [scenarioDraft, setScenarioDraft] = useState<Record<string, string>>({})

  const toggleRunner = (key: string, defaultScenario: Record<string, unknown>) => {
    setOpenRunner((prev) => ({ ...prev, [key]: !prev[key] }))
    setScenarioDraft((prev) => (prev[key] ? prev : { ...prev, [key]: JSON.stringify(defaultScenario, null, 2) }))
  }

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

  /** Twin/preset → snapshot → scenario → execution contract. Saved twins (twinId set) always
   *  run through /api/twins/{id}/run, which guarantees the same twin instance is reused on
   *  every call; presets with no saved twin yet fall back to the module-centric demo route. */
  const runTwin = async (
    key: string,
    moduleId: FinanceModuleId,
    opts: { scenario: Record<string, unknown>; computeMode: "classical" | "quantum-inspired"; twinId?: string; useDemo: boolean; snapshot?: unknown; seed?: number },
  ) => {
    setRunState((prev) => ({ ...prev, [key]: { loading: true, error: null, run: null } }))
    try {
      const endpoint = opts.twinId ? `/api/twins/${opts.twinId}/run` : `/api/finance/${moduleId}/run`
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          useDemo: opts.useDemo,
          snapshot: opts.useDemo ? undefined : opts.snapshot,
          scenario: opts.scenario,
          computeMode: opts.computeMode,
          seed: opts.seed,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setRunState((prev) => ({ ...prev, [key]: { loading: false, error: data.error || `Request failed (${res.status})`, run: null } }))
        return
      }
      setRunState((prev) => ({ ...prev, [key]: { loading: false, error: null, run: { ...data.run, requestedMode: opts.computeMode } } }))
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
                  <Button size="sm" disabled={s?.loading} onClick={() => runTwin(mod.id, mod.id, { scenario: mod.demoScenario, computeMode: "classical", useDemo: true })}>
                    {s?.loading ? "Running…" : "Run demo (classical)"}
                  </Button>
                  <Button size="sm" variant="outline" disabled={s?.loading} onClick={() => runTwin(mod.id, mod.id, { scenario: mod.demoScenario, computeMode: "quantum-inspired", useDemo: true })}>
                    Run demo (quantum-inspired)
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleRunner(mod.id, mod.demoScenario)}>
                    {openRunner[mod.id] ? "Hide runner" : "Open in Runner"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openCreateFor(mod.id, mod.demoScenario)}>
                    Use as my twin
                  </Button>
                </div>

                {openRunner[mod.id] && (
                  <RunnerPanel
                    scenarioText={scenarioDraft[mod.id] ?? JSON.stringify(mod.demoScenario, null, 2)}
                    onScenarioChange={(v) => setScenarioDraft((prev) => ({ ...prev, [mod.id]: v }))}
                    loading={!!s?.loading}
                    onRun={(scenario, computeMode, dataMode, snapshot, seed) =>
                      runTwin(mod.id, mod.id, { scenario, computeMode, useDemo: dataMode === "demo", snapshot, seed })
                    }
                  />
                )}

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
                        runTwin(twin.id, twin.moduleId, {
                          scenario: twin.config?.scenario ?? BUILTIN_MODULES.find((m) => m.id === twin.moduleId)?.demoScenario ?? {},
                          computeMode: "classical",
                          useDemo: true,
                          twinId: twin.id,
                        })
                      }
                    >
                      {s?.loading ? "Running…" : "Quick demo run"}
                    </Button>
                    {twin.visibility === "private" ? (
                      <Button size="sm" variant="outline" onClick={() => publishTwin(twin, "public")}>Publish</Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => publishTwin(twin, "private")}>Unpublish</Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleRunner(twin.id, twin.config?.scenario ?? BUILTIN_MODULES.find((m) => m.id === twin.moduleId)?.demoScenario ?? {})}
                    >
                      {openRunner[twin.id] ? "Hide runner" : "Open in Runner"}
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => deleteTwin(twin)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>

                  {openRunner[twin.id] && (
                    <RunnerPanel
                      scenarioText={scenarioDraft[twin.id] ?? JSON.stringify(twin.config?.scenario ?? {}, null, 2)}
                      onScenarioChange={(v) => setScenarioDraft((prev) => ({ ...prev, [twin.id]: v }))}
                      loading={!!s?.loading}
                      onRun={(scenario, computeMode, dataMode, snapshot, seed) =>
                        runTwin(twin.id, twin.moduleId, { scenario, computeMode, useDemo: dataMode === "demo", snapshot, seed, twinId: twin.id })
                      }
                    />
                  )}

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

/** Inline "Open in Runner" panel — scenario/constraints editor (level 1), Execute
 *  action (level 2), and a collapsed "Advanced Compute Settings" (level 3: compute
 *  mode + seed). The caller always passes the same twinId for a given card, so
 *  repeated runs reuse that twin instance instead of creating a new one each time. */
function RunnerPanel({
  scenarioText,
  onScenarioChange,
  loading,
  onRun,
}: {
  scenarioText: string
  onScenarioChange: (v: string) => void
  loading: boolean
  onRun: (
    scenario: Record<string, unknown>,
    computeMode: "classical" | "quantum-inspired",
    dataMode: "demo" | "own",
    snapshot: unknown,
    seed: number | undefined,
  ) => void
}) {
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [dataMode, setDataMode] = useState<"demo" | "own">("demo")
  const [snapshotText, setSnapshotText] = useState("{\n  \n}")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [computeMode, setComputeMode] = useState<"classical" | "quantum-inspired">("classical")
  const [seedText, setSeedText] = useState("")

  const run = () => {
    try {
      const scenario = scenarioText.trim() ? JSON.parse(scenarioText) : {}
      let snapshot: unknown = undefined
      if (dataMode === "own") {
        snapshot = snapshotText.trim() ? JSON.parse(snapshotText) : {}
      }
      setJsonError(null)
      const seed = seedText.trim() ? Number(seedText) : undefined
      onRun(scenario, computeMode, dataMode, snapshot, Number.isFinite(seed) ? seed : undefined)
    } catch {
      setJsonError("Scenario/snapshot must be valid JSON")
    }
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
      <div>
        <p className="text-xs font-semibold text-foreground mb-1">Data</p>
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => setDataMode("demo")}
            className={`px-2 py-1 text-xs rounded ${dataMode === "demo" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}
          >
            Demo data
          </button>
          <button
            type="button"
            onClick={() => setDataMode("own")}
            className={`px-2 py-1 text-xs rounded ${dataMode === "own" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}
          >
            My data
          </button>
        </div>
        {dataMode === "own" && (
          <textarea
            value={snapshotText}
            onChange={(e) => setSnapshotText(e.target.value)}
            rows={5}
            placeholder="Paste your own snapshot JSON (matches this module's schema)"
            className="w-full px-2 py-1.5 bg-background border border-border rounded-md text-[11px] font-mono text-foreground"
            spellCheck={false}
          />
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-foreground mb-1">Scenario &amp; constraints</p>
        <textarea
          value={scenarioText}
          onChange={(e) => onScenarioChange(e.target.value)}
          rows={6}
          className="w-full px-2 py-1.5 bg-background border border-border rounded-md text-[11px] font-mono text-foreground"
          spellCheck={false}
        />
      </div>

      {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}

      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
      >
        {showAdvanced ? "Hide" : "Show"} Advanced Compute Settings
      </button>
      {showAdvanced && (
        <div className="rounded-md border border-border/60 bg-background/40 p-2 space-y-2">
          <div>
            <p className="text-[11px] text-muted-foreground mb-1">Compute mode</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setComputeMode("classical")}
                className={`px-2 py-1 text-xs rounded ${computeMode === "classical" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}
              >
                Classical (baseline solver)
              </button>
              <button
                type="button"
                onClick={() => setComputeMode("quantum-inspired")}
                className={`px-2 py-1 text-xs rounded ${computeMode === "quantum-inspired" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}
              >
                Quantum-inspired (experimental)
              </button>
            </div>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground mb-1">Seed (optional — overrides auto-derived seed)</p>
            <input
              type="number"
              value={seedText}
              onChange={(e) => setSeedText(e.target.value)}
              placeholder="auto"
              className="w-32 px-2 py-1 bg-background border border-border rounded-md text-xs text-foreground"
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={loading} onClick={run}>
          {loading ? "Running…" : "Execute"}
        </Button>
      </div>
    </div>
  )
}

function RunResult({ state: s }: { state: RunState | undefined }) {
  const [showDetails, setShowDetails] = useState(false)
  if (!s) return null
  const run = s.run
  return (
    <>
      {s.error && <p className="text-xs text-destructive">{s.error}</p>}
      {run && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-xs">
          <div className="flex flex-wrap gap-1.5">
            {run.requestedMode && run.requestedMode !== run.executionMode && (
              <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium" title="Requested compute mode">
                requested: {run.requestedMode}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium" title="Compute mode actually executed">
              executed: {run.executionMode}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">{run.solverActual}</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium">
              {run.isSynthetic ? "synthetic demo data" : "user data"}
            </span>
            <span className={`px-2 py-0.5 rounded-full font-medium ${run.status === "completed" ? "bg-green-500/10 text-green-600" : "bg-orange-500/10 text-orange-600"}`}>
              {run.status}
            </span>
          </div>
          {run.capability && (
            <p className="text-muted-foreground italic">Experimental route unavailable: {run.capability.reason}</p>
          )}
          <pre className="overflow-x-auto whitespace-pre-wrap break-all text-[11px] leading-snug">
            {JSON.stringify(run.kpis, null, 2)}
          </pre>
          {run.warnings?.length > 0 && (
            <ul className="list-disc list-inside text-muted-foreground">
              {run.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            {showDetails ? "Hide" : "Show"} lineage &amp; technical details
          </button>
          {showDetails && (
            <div className="rounded-md border border-border/60 bg-background/40 p-2 space-y-1 text-[11px] text-muted-foreground">
              <p>run_id: <span className="font-mono text-foreground">{run.runId}</span></p>
              <p>twin_id: <span className="font-mono text-foreground">{run.twinId}</span></p>
              <p>snapshot_id: <span className="font-mono text-foreground">{run.snapshotId}</span></p>
              <p>snapshot_hash: <span className="font-mono text-foreground">{run.snapshotHash}</span></p>
              <p>model_version: <span className="font-mono text-foreground">{run.modelVersion}</span></p>
              <p>seed: <span className="font-mono text-foreground">{run.seed}</span></p>
              {run.baseline && (
                <>
                  <p className="pt-1 font-semibold text-foreground">Baseline (classical) result</p>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(run.baseline, null, 2)}</pre>
                </>
              )}
            </div>
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

