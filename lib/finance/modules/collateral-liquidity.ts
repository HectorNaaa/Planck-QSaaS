/**
 * lib/finance/modules/collateral-liquidity.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Collateral & Liquidity Twin — allocates account balances to funding
 * obligations at minimum cost.
 *
 * Baseline (classical, exact): the problem is a transportation-style min-cost
 * flow (source → accounts → obligations → sink, capacities = usable balance /
 * amount due). Because capacities are integral and the constraint matrix of a
 * transportation problem is totally unimodular, the successive-shortest-path
 * min-cost-flow algorithm implemented here returns the true LP/MILP optimum
 * for this formulation — it is an exact solver, not a heuristic.
 *
 * Experimental (quantum-inspired, classical): the same obligations are split
 * into fixed-size "chunks" and assigned to eligible accounts via simulated
 * annealing with a capacity-violation penalty, followed by a greedy repair
 * pass. This is honestly labelled "quantum-inspired" (a classical
 * metaheuristic in the same family used by QUBO/annealing approaches) — no
 * QPU or QAOA circuit is executed. It is compared against the exact MCMF
 * baseline to report an optimality gap.
 *
 * Scope: this module proposes a sandboxed allocation. It never moves money,
 * places orders, or connects to production accounts.
 */
import { z } from "zod"
import type { FinanceModuleDefinition, LineageEntry } from "@/lib/finance/types"
import { mulberry32 } from "@/lib/finance/random"

// ─── Schemas ─────────────────────────────────────────────────────────────────
export const CollateralAccountSchema = z.object({
  id: z.string().min(1).max(64),
  currency: z.string().length(3),
  balance: z.number().finite().nonnegative(),
  /** Fraction [0,1) reserved and never available for transfer (buffer). */
  bufferReserve: z.number().min(0).max(1).default(0),
  /** Fraction [0,1) haircut applied to the balance's usable value (e.g. non-cash collateral). */
  haircut: z.number().min(0).max(1).default(0),
  /** Max amount that can be moved out of this account within the funding window. */
  transferLimit: z.number().finite().nonnegative(),
  /** Cost in bps per unit moved/pledged from this account. */
  costBps: z.number().finite().nonnegative(),
})

export const CollateralObligationSchema = z.object({
  id: z.string().min(1).max(64),
  currency: z.string().length(3),
  amountDue: z.number().finite().positive(),
  cutoff: z.string().min(1),
  eligibleAccountIds: z.array(z.string()).min(1),
})

export const CollateralSnapshotSchema = z.object({
  asOf: z.string().min(1),
  currency: z.string().length(3),
  accounts: z.array(CollateralAccountSchema).min(1).max(30),
  obligations: z.array(CollateralObligationSchema).min(1).max(30),
})
export type CollateralSnapshotInput = z.infer<typeof CollateralSnapshotSchema>

export const CollateralScenarioSchema = z.object({
  /** Multiplies every obligation's amountDue (stress test, e.g. 1.5 = +50%). */
  stressMultiplier: z.number().finite().positive().max(10).default(1),
  annealingIterations: z.number().int().min(200).max(20000).default(4000),
  /** Chunk count per obligation for the annealing encoding — bounds problem size. */
  chunksPerObligation: z.number().int().min(2).max(40).default(10),
})
export type CollateralScenarioInput = z.infer<typeof CollateralScenarioSchema>

export interface AllocationEdge {
  accountId: string
  obligationId: string
  amount: number
}

export interface CollateralResult {
  allocations: AllocationEdge[]
  totalCost: number
  totalCostBps: number
  totalFunded: number
  totalDemand: number
  shortfall: number
  hardViolations: string[]
  perObligationFunded: Record<string, number>
}

export interface CollateralKpis {
  bpsOverOptimizableCapital: number
  immobilizedCollateral: number
  shortfallUnderStress: number
  timeMs: number
  optimalityGapPct: number | null
}

function usableCapacity(a: z.infer<typeof CollateralAccountSchema>): number {
  return Math.max(0, a.balance * (1 - a.bufferReserve) * (1 - a.haircut) - 0)
}

// ─── Exact solver: successive-shortest-path min-cost flow ──────────────────
interface FlowEdge { to: number; cap: number; cost: number; flow: number; revIndex: number }

function addEdge(graph: FlowEdge[][], from: number, to: number, cap: number, cost: number) {
  const fwdIndex = graph[from].length
  const revIndex = graph[to].length
  graph[from].push({ to, cap, cost, flow: 0, revIndex })
  graph[to].push({ to: from, cap: 0, cost: -cost, flow: 0, revIndex: fwdIndex })
}

/** Successive-shortest-augmenting-path min-cost flow via Bellman-Ford (handles negative residual edges). */
function minCostFlow(graph: FlowEdge[][], source: number, sink: number): { flow: number; cost: number } {
  const n = graph.length
  let totalFlow = 0
  let totalCost = 0

  for (;;) {
    const dist = new Array(n).fill(Infinity)
    const inQueue = new Array(n).fill(false)
    const prevEdge: (number | null)[] = new Array(n).fill(null)
    const prevNode: (number | null)[] = new Array(n).fill(null)
    dist[source] = 0
    const queue = [source]
    inQueue[source] = true
    while (queue.length) {
      const u = queue.shift() as number
      inQueue[u] = false
      for (let ei = 0; ei < graph[u].length; ei++) {
        const e = graph[u][ei]
        if (e.cap - e.flow <= 1e-9) continue
        const nd = dist[u] + e.cost
        if (nd < dist[e.to] - 1e-9) {
          dist[e.to] = nd
          prevNode[e.to] = u
          prevEdge[e.to] = ei
          if (!inQueue[e.to]) {
            queue.push(e.to)
            inQueue[e.to] = true
          }
        }
      }
    }
    if (dist[sink] === Infinity) break

    // bottleneck along the found path
    let bottleneck = Infinity
    let v = sink
    while (v !== source) {
      const u = prevNode[v] as number
      const ei = prevEdge[v] as number
      bottleneck = Math.min(bottleneck, graph[u][ei].cap - graph[u][ei].flow)
      v = u
    }
    if (!isFinite(bottleneck) || bottleneck <= 1e-9) break

    v = sink
    while (v !== source) {
      const u = prevNode[v] as number
      const ei = prevEdge[v] as number
      const e = graph[u][ei]
      e.flow += bottleneck
      graph[e.to][e.revIndex].flow -= bottleneck
      v = u
    }
    totalFlow += bottleneck
    totalCost += bottleneck * dist[sink]
  }

  return { flow: totalFlow, cost: totalCost }
}

function solveExact(
  accounts: z.infer<typeof CollateralSnapshotSchema>["accounts"],
  obligations: z.infer<typeof CollateralSnapshotSchema>["obligations"],
  stressMultiplier: number,
): CollateralResult {
  const nA = accounts.length
  const nO = obligations.length
  const source = 0
  const accountBase = 1
  const obligationBase = 1 + nA
  const sink = 1 + nA + nO
  const graph: FlowEdge[][] = Array.from({ length: sink + 1 }, () => [])

  const capacities = accounts.map((a) => Math.min(usableCapacity(a), a.transferLimit))
  const demands = obligations.map((o) => o.amountDue * stressMultiplier)

  accounts.forEach((_, i) => addEdge(graph, source, accountBase + i, capacities[i], 0))
  obligations.forEach((_, j) => addEdge(graph, obligationBase + j, sink, demands[j], 0))
  accounts.forEach((a, i) => {
    obligations.forEach((o, j) => {
      if (o.eligibleAccountIds.includes(a.id) && o.currency === a.currency) {
        addEdge(graph, accountBase + i, obligationBase + j, capacities[i], a.costBps)
      }
    })
  })

  const { flow, cost } = minCostFlow(graph, source, sink)

  const allocations: AllocationEdge[] = []
  const perObligationFunded: Record<string, number> = Object.fromEntries(obligations.map((o) => [o.id, 0]))
  accounts.forEach((a, i) => {
    for (const e of graph[accountBase + i]) {
      if (e.to >= obligationBase && e.to < sink && e.flow > 1e-9) {
        const o = obligations[e.to - obligationBase]
        allocations.push({ accountId: a.id, obligationId: o.id, amount: e.flow })
        perObligationFunded[o.id] += e.flow
      }
    }
  })

  const totalDemand = demands.reduce((s, d) => s + d, 0)
  const hardViolations: string[] = []
  accounts.forEach((a, i) => {
    const used = allocations.filter((e) => e.accountId === a.id).reduce((s, e) => s + e.amount, 0)
    if (used > capacities[i] + 1e-6) hardViolations.push(`Account ${a.id} allocation ${used} exceeds usable capacity ${capacities[i]}`)
  })

  return {
    allocations,
    totalCost: cost / 10000,
    totalCostBps: flow > 0 ? cost / flow : 0,
    totalFunded: flow,
    totalDemand,
    shortfall: Math.max(0, totalDemand - flow),
    hardViolations,
    perObligationFunded,
  }
}

// ─── Experimental: simulated annealing over a chunked encoding + repair ────
function solveAnnealing(
  accounts: z.infer<typeof CollateralSnapshotSchema>["accounts"],
  obligations: z.infer<typeof CollateralSnapshotSchema>["obligations"],
  stressMultiplier: number,
  chunksPerObligation: number,
  iterations: number,
  seed: number,
): { result: CollateralResult; lineage: LineageEntry[] } {
  const rng = mulberry32(seed)
  const lineage: LineageEntry[] = []
  const capacities = new Map(accounts.map((a) => [a.id, Math.min(usableCapacity(a), a.transferLimit)]))
  const costOf = new Map(accounts.map((a) => [a.id, a.costBps]))

  type Chunk = { obligationId: string; size: number; eligible: string[] }
  const chunks: Chunk[] = []
  for (const o of obligations) {
    const total = o.amountDue * stressMultiplier
    const size = total / chunksPerObligation
    const eligible = o.eligibleAccountIds.filter((id) => {
      const acc = accounts.find((a) => a.id === id)
      return acc && acc.currency === o.currency
    })
    for (let c = 0; c < chunksPerObligation; c++) chunks.push({ obligationId: o.id, size, eligible })
  }
  lineage.push({ step: "encode", detail: `${chunks.length} chunks across ${obligations.length} obligations (max ${chunksPerObligation}/obligation)`, at: new Date().toISOString() })

  // initial assignment: first eligible account for every chunk
  let assignment = chunks.map((c) => c.eligible[0] ?? null)

  const usageByAccount = (assign: (string | null)[]) => {
    const usage = new Map(accounts.map((a) => [a.id, 0]))
    assign.forEach((accId, i) => {
      if (accId) usage.set(accId, (usage.get(accId) ?? 0) + chunks[i].size)
    })
    return usage
  }

  const penaltyWeight = 50 // bps-equivalent penalty per unit of capacity overflow
  const energy = (assign: (string | null)[]): number => {
    const usage = usageByAccount(assign)
    let cost = 0
    for (let i = 0; i < assign.length; i++) {
      const accId = assign[i]
      if (!accId) { cost += 1e6; continue } // unassigned chunk — heavy penalty
      cost += chunks[i].size * (costOf.get(accId) ?? 0)
    }
    for (const [accId, used] of usage.entries()) {
      const over = Math.max(0, used - (capacities.get(accId) ?? 0))
      cost += over * penaltyWeight
    }
    return cost
  }

  let currentEnergy = energy(assignment)
  const T0 = 100
  for (let iter = 0; iter < iterations; iter++) {
    const T = T0 * (1 - iter / iterations)
    const i = Math.floor(rng() * chunks.length)
    const options = chunks[i].eligible
    if (options.length === 0) continue
    const candidate = options[Math.floor(rng() * options.length)]
    const next = assignment.slice()
    next[i] = candidate
    const nextEnergy = energy(next)
    const delta = nextEnergy - currentEnergy
    if (delta <= 0 || rng() < Math.exp(-delta / Math.max(T, 1e-6))) {
      assignment = next
      currentEnergy = nextEnergy
    }
  }
  lineage.push({ step: "anneal", detail: `${iterations} iterations, final energy=${currentEnergy.toFixed(2)}`, at: new Date().toISOString() })

  // greedy repair: move overflow chunks from over-capacity accounts to the cheapest account with headroom
  const usage = usageByAccount(assignment)
  for (let i = 0; i < assignment.length; i++) {
    const accId = assignment[i]
    if (!accId) continue
    const cap = capacities.get(accId) ?? 0
    if ((usage.get(accId) ?? 0) > cap) {
      const alt = chunks[i].eligible
        .filter((id) => id !== accId)
        .sort((a, b) => (costOf.get(a) ?? Infinity) - (costOf.get(b) ?? Infinity))
        .find((id) => (usage.get(id) ?? 0) + chunks[i].size <= (capacities.get(id) ?? 0))
      if (alt) {
        usage.set(accId, (usage.get(accId) ?? 0) - chunks[i].size)
        usage.set(alt, (usage.get(alt) ?? 0) + chunks[i].size)
        assignment[i] = alt
      }
    }
  }
  lineage.push({ step: "repair", detail: "greedy reassignment of any remaining over-capacity chunks", at: new Date().toISOString() })

  const allocations: AllocationEdge[] = []
  const perAccountObligation = new Map<string, number>()
  const perObligationFunded: Record<string, number> = Object.fromEntries(obligations.map((o) => [o.id, 0]))
  assignment.forEach((accId, i) => {
    if (!accId) return
    const key = `${accId}::${chunks[i].obligationId}`
    perAccountObligation.set(key, (perAccountObligation.get(key) ?? 0) + chunks[i].size)
    perObligationFunded[chunks[i].obligationId] += chunks[i].size
  })
  for (const [key, amount] of perAccountObligation.entries()) {
    const [accountId, obligationId] = key.split("::")
    allocations.push({ accountId, obligationId, amount })
  }

  const totalFunded = allocations.reduce((s, a) => s + a.amount, 0)
  const totalDemand = obligations.reduce((s, o) => s + o.amountDue * stressMultiplier, 0)
  const totalCostBps = allocations.reduce((s, a) => s + a.amount * (costOf.get(a.accountId) ?? 0), 0) / Math.max(totalFunded, 1e-9)
  const hardViolations: string[] = []
  const finalUsage = usageByAccount(assignment)
  for (const [accId, used] of finalUsage.entries()) {
    const cap = capacities.get(accId) ?? 0
    if (used > cap + 1e-6) hardViolations.push(`Account ${accId} allocation ${used.toFixed(2)} exceeds usable capacity ${cap.toFixed(2)} after repair`)
  }

  return {
    result: {
      allocations,
      totalCost: allocations.reduce((s, a) => s + (a.amount * (costOf.get(a.accountId) ?? 0)) / 10000, 0),
      totalCostBps,
      totalFunded,
      totalDemand,
      shortfall: Math.max(0, totalDemand - totalFunded),
      hardViolations,
      perObligationFunded,
    },
    lineage,
  }
}

export const collateralLiquidityModule: FinanceModuleDefinition<
  CollateralSnapshotInput,
  CollateralScenarioInput,
  CollateralResult,
  CollateralKpis
> = {
  id: "collateral-liquidity",
  name: "Collateral & Liquidity Twin",
  description: "Minimum-cost funding/collateral allocation across accounts, with an exact min-cost-flow baseline.",
  clientProfile: "Multi-account treasuries, payments/FX fintechs, brokers and collateral desks.",

  parseSnapshot: (raw) => CollateralSnapshotSchema.parse(raw),
  parseScenario: (raw) => CollateralScenarioSchema.parse(raw),

  runClassical: (snapshot, scenario) => {
    const tStart = Date.now()
    const lineage: LineageEntry[] = [{ step: "validate", detail: `${snapshot.accounts.length} accounts, ${snapshot.obligations.length} obligations`, at: new Date().toISOString() }]
    const warnings: string[] = []

    const result = solveExact(snapshot.accounts, snapshot.obligations, scenario.stressMultiplier)
    if (result.shortfall > 1e-6) {
      warnings.push(`Shortfall of ${result.shortfall.toFixed(2)} could not be funded from eligible accounts under current capacity.`)
    }
    const tEnd = Date.now()

    const totalOptimizable = snapshot.accounts.reduce((s, a) => s + Math.min(usableCapacity(a), a.transferLimit), 0)
    const kpis: CollateralKpis = {
      bpsOverOptimizableCapital: totalOptimizable > 0 ? (result.totalCost * 10000) / totalOptimizable : 0,
      immobilizedCollateral: Math.max(0, totalOptimizable - result.totalFunded),
      shortfallUnderStress: result.shortfall,
      timeMs: tEnd - tStart,
      optimalityGapPct: 0, // this IS the exact optimum
    }
    lineage.push({ step: "solve", detail: `min-cost-flow: funded=${result.totalFunded.toFixed(2)} cost=${result.totalCost.toFixed(4)}`, at: new Date().toISOString() })

    return { result, kpis, solverActual: "min-cost-flow-successive-shortest-paths", lineage, warnings }
  },

  runExperimental: (snapshot, scenario, seed, baseline) => {
    const tStart = Date.now()
    const { result, lineage } = solveAnnealing(
      snapshot.accounts,
      snapshot.obligations,
      scenario.stressMultiplier,
      scenario.chunksPerObligation,
      scenario.annealingIterations,
      seed,
    )
    const tEnd = Date.now()
    const warnings: string[] = [
      "Classical simulated annealing (quantum-inspired), not a QAOA circuit or QPU execution — no quantum backend is integrated in this pilot.",
    ]
    if (result.hardViolations.length > 0) warnings.push(`${result.hardViolations.length} capacity violation(s) remained after the repair pass.`)

    const totalOptimizable = snapshot.accounts.reduce((s, a) => s + Math.min(usableCapacity(a), a.transferLimit), 0)
    const optimalityGapPct = baseline.result.totalCost > 0
      ? ((result.totalCost - baseline.result.totalCost) / baseline.result.totalCost) * 100
      : (result.totalCost > 0 ? Infinity : 0)

    const kpis: CollateralKpis = {
      bpsOverOptimizableCapital: totalOptimizable > 0 ? (result.totalCost * 10000) / totalOptimizable : 0,
      immobilizedCollateral: Math.max(0, totalOptimizable - result.totalFunded),
      shortfallUnderStress: result.shortfall,
      timeMs: tEnd - tStart,
      optimalityGapPct,
    }

    return {
      available: true,
      result,
      kpis,
      executionMode: "quantum-inspired",
      solverActual: "simulated-annealing-qubo-penalty+greedy-repair",
      lineage,
      warnings,
    }
  },
}
