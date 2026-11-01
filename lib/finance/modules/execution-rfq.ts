/**
 * Execution / RFQ & Market Microstructure Twin — allocates one order across
 * venues/quotes to minimize net execution cost (buy) or maximize net proceeds
 * (sell), including fees, size limits and quote TTL.
 *
 * Baseline (classical, exact for the divisible-size relaxation): quotes are
 * ranked by net effective price (after fees) and filled greedily — a
 * provably-optimal water-filling allocation, benchmarked against a naive
 * "best nominal price" strategy to show headline-best isn't always net-best.
 *
 * Experimental (quantum-inspired, classical): rediscretized into fixed lot
 * sizes and solved via simulated annealing vs. the exact greedy baseline.
 *
 * Fill-rate prediction is intentionally NOT implemented — no historical fill
 * data exists in this pilot snapshot, so it's reported unavailable rather
 * than fabricated.
 */
import { z } from "zod"
import type { FinanceModuleDefinition, LineageEntry } from "@/lib/finance/types"
import { mulberry32 } from "@/lib/finance/random"
import { quantile } from "@/lib/finance/stats"

// ─── Schemas ─────────────────────────────────────────────────────────────────
export const RfqQuoteSchema = z.object({
  venue: z.string().min(1).max(64),
  price: z.number().finite().positive(),
  size: z.number().finite().positive(),
  feeBps: z.number().finite().min(0).max(1000),
  timestamp: z.string().min(1),
  ttlMs: z.number().finite().positive(),
  /** Optional synthetic round-trip latency for this quote's venue, in ms — used for p50/p95 KPI only. */
  latencyMs: z.number().finite().nonnegative().optional(),
})

export const RfqSnapshotSchema = z.object({
  asOf: z.string().min(1),
  side: z.enum(["buy", "sell"]),
  orderSize: z.number().finite().positive(),
  quotes: z.array(RfqQuoteSchema).min(1).max(100),
})
export type RfqSnapshotInput = z.infer<typeof RfqSnapshotSchema>

export const RfqScenarioSchema = z.object({
  /** Replay decision point — only quotes alive (timestamp <= decisionTime <= timestamp+ttl) are eligible. */
  decisionTime: z.string().min(1),
  annealingIterations: z.number().int().min(200).max(20000).default(3000),
  lotSize: z.number().finite().positive().default(1),
})
export type RfqScenarioInput = z.infer<typeof RfqScenarioSchema>

export interface RfqAllocation {
  venue: string
  size: number
  price: number
  feeBps: number
  netUnitPrice: number
}

export interface RfqResult {
  side: "buy" | "sell"
  allocations: RfqAllocation[]
  filled: number
  orderSize: number
  fillRate: number
  netCost: number
  benchmarkNetCost: number
  benchmarkVenue: string | null
  shortfallBps: number
  latencyP50Ms: number | null
  latencyP95Ms: number | null
  fillPredictionAvailable: false
  fillPredictionReason: string
}

export interface RfqKpis {
  costBps: number
  fillRate: number
  timeMs: number
  optimalityGapPct: number | null
}

function aliveQuotes(quotes: RfqSnapshotInput["quotes"], decisionTime: string) {
  const t = new Date(decisionTime).getTime()
  if (Number.isNaN(t)) throw new Error(`Invalid decisionTime: ${decisionTime}`)
  return quotes.filter((q) => {
    const ts = new Date(q.timestamp).getTime()
    if (Number.isNaN(ts)) throw new Error(`Invalid quote timestamp: ${q.timestamp}`)
    return ts <= t && t <= ts + q.ttlMs
  })
}

function netUnitPrice(side: "buy" | "sell", price: number, feeBps: number): number {
  // buy: cost per unit paid (higher is worse); sell: proceeds per unit received (higher is better)
  return side === "buy" ? price * (1 + feeBps / 10000) : price * (1 - feeBps / 10000)
}

/** Exact greedy allocation for the divisible-size relaxation: fill cheapest(best) net price first. */
function greedyAllocate(side: "buy" | "sell", quotes: RfqSnapshotInput["quotes"], orderSize: number): { allocations: RfqAllocation[]; filled: number; netCost: number } {
  const ranked = [...quotes].sort((a, b) => {
    const na = netUnitPrice(side, a.price, a.feeBps)
    const nb = netUnitPrice(side, b.price, b.feeBps)
    return side === "buy" ? na - nb : nb - na
  })
  let remaining = orderSize
  const allocations: RfqAllocation[] = []
  let netCost = 0
  for (const q of ranked) {
    if (remaining <= 1e-9) break
    const take = Math.min(remaining, q.size)
    const unit = netUnitPrice(side, q.price, q.feeBps)
    allocations.push({ venue: q.venue, size: take, price: q.price, feeBps: q.feeBps, netUnitPrice: unit })
    netCost += take * unit
    remaining -= take
  }
  return { allocations, filled: orderSize - remaining, netCost }
}

function bestNominalBenchmark(side: "buy" | "sell", quotes: RfqSnapshotInput["quotes"], orderSize: number): { netCost: number; filled: number; venue: string | null } {
  if (quotes.length === 0) return { netCost: 0, filled: 0, venue: null }
  const best = [...quotes].sort((a, b) => (side === "buy" ? a.price - b.price : b.price - a.price))[0]
  // naive strategy routes 100% to the headline-best venue, spilling to the next-best headline price if size runs out
  const ranked = [...quotes].sort((a, b) => (side === "buy" ? a.price - b.price : b.price - a.price))
  let remaining = orderSize
  let netCost = 0
  for (const q of ranked) {
    if (remaining <= 1e-9) break
    const take = Math.min(remaining, q.size)
    netCost += take * netUnitPrice(side, q.price, q.feeBps)
    remaining -= take
  }
  return { netCost, filled: orderSize - remaining, venue: best.venue }
}

// Hard cap on discretized annealing decision variables. The annealing loop below costs
// O(numLots × annealingIterations); with orderSize/lotSize uncapped, a large order paired
// with a small lotSize (e.g. the scenario default) can request tens of millions of lots and
// block Node's single thread for minutes — this happened in practice with a $25M order and
// lotSize=1. 2,000 lots × the schema's max 20,000 iterations is ~40M cheap map-lookup steps
// (sub-second in V8), while still giving fine-enough granularity for any realistic order.
const MAX_ANNEALING_LOTS = 2000

export const executionRfqModule: FinanceModuleDefinition<RfqSnapshotInput, RfqScenarioInput, RfqResult, RfqKpis> = {
  id: "execution-rfq",
  name: "Execution / RFQ & Market Microstructure Twin",
  description: "Replay-based order allocation across venues/quotes, benchmarked against naive best-nominal-price routing.",
  clientProfile: "Brokers, FX platforms and trading fintechs comparing venue quotes/RFQs.",

  parseSnapshot: (raw) => RfqSnapshotSchema.parse(raw),
  parseScenario: (raw) => RfqScenarioSchema.parse(raw),

  runClassical: (snapshot, scenario) => {
    const tStart = Date.now()
    const lineage: LineageEntry[] = []
    const warnings: string[] = []

    const alive = aliveQuotes(snapshot.quotes, scenario.decisionTime)
    if (alive.length === 0) throw new Error(`No quotes are alive at decisionTime=${scenario.decisionTime} (all expired or not yet posted)`)
    lineage.push({ step: "replay", detail: `${alive.length}/${snapshot.quotes.length} quotes alive at ${scenario.decisionTime}`, at: new Date().toISOString() })

    const { allocations, filled, netCost } = greedyAllocate(snapshot.side, alive, snapshot.orderSize)
    const benchmark = bestNominalBenchmark(snapshot.side, alive, snapshot.orderSize)
    if (filled < snapshot.orderSize - 1e-6) warnings.push(`Only ${filled.toFixed(4)}/${snapshot.orderSize} could be filled from alive quotes (insufficient total size).`)

    const latencies = alive.map((q) => q.latencyMs).filter((v): v is number => typeof v === "number")
    const latencyP50 = latencies.length > 0 ? quantile(latencies, 0.5) : null
    const latencyP95 = latencies.length > 0 ? quantile(latencies, 0.95) : null

    // shortfall in bps: positive = our allocation is cheaper/better than the naive benchmark
    const shortfallBps = benchmark.netCost !== 0
      ? ((snapshot.side === "buy" ? benchmark.netCost - netCost : netCost - benchmark.netCost) / Math.abs(benchmark.netCost)) * 10000
      : 0

    const tEnd = Date.now()
    const result: RfqResult = {
      side: snapshot.side,
      allocations,
      filled,
      orderSize: snapshot.orderSize,
      fillRate: filled / snapshot.orderSize,
      netCost,
      benchmarkNetCost: benchmark.netCost,
      benchmarkVenue: benchmark.venue,
      shortfallBps,
      latencyP50Ms: latencyP50,
      latencyP95Ms: latencyP95,
      fillPredictionAvailable: false,
      fillPredictionReason: "No historical fill data present in this snapshot — fill-rate prediction is not modeled to avoid fabricating a calibration.",
    }
    const kpis: RfqKpis = {
      costBps: shortfallBps,
      fillRate: result.fillRate,
      timeMs: tEnd - tStart,
      optimalityGapPct: 0, // exact for the divisible-size relaxation
    }
    lineage.push({ step: "allocate", detail: `netCost=${netCost.toFixed(4)} vs benchmark=${benchmark.netCost.toFixed(4)} (${shortfallBps.toFixed(1)} bps)`, at: new Date().toISOString() })

    return { result, kpis, solverActual: "greedy-net-price-ranking", lineage, warnings }
  },

  runExperimental: (snapshot, scenario, seed, baseline) => {
    const tStart = Date.now()
    const alive = aliveQuotes(snapshot.quotes, scenario.decisionTime)
    const rng = mulberry32(seed)
    const lineage: LineageEntry[] = []
    const warnings: string[] = [
      "Classical simulated annealing (quantum-inspired) over discretized lots — no QAOA circuit or QPU execution is integrated in this pilot.",
    ]

    const rawNumLots = Math.max(1, Math.round(snapshot.orderSize / scenario.lotSize))
    const numLots = Math.min(rawNumLots, MAX_ANNEALING_LOTS)
    const lotSize = snapshot.orderSize / numLots
    lineage.push({ step: "encode", detail: `${numLots} lots of size ${lotSize.toFixed(4)} across ${alive.length} venues`, at: new Date().toISOString() })
    if (rawNumLots > MAX_ANNEALING_LOTS) {
      warnings.push(
        `Requested lotSize=${scenario.lotSize} would discretize this order into ${rawNumLots} lots — capped to ${MAX_ANNEALING_LOTS} (effective lot size ${lotSize.toFixed(4)}) to bound annealing cost. No iterations or quality were silently skipped — this only coarsens the discretization grid.`,
      )
    }

    const capacity = new Map(alive.map((q) => [q.venue, q.size]))
    const quoteByVenue = new Map(alive.map((q) => [q.venue, q]))
    let assignment = new Array(numLots).fill(alive[0]?.venue ?? null)

    const energy = (assign: (string | null)[]): number => {
      const used = new Map<string, number>()
      let cost = 0
      for (const venue of assign) {
        if (!venue) { cost += 1e6; continue }
        const q = quoteByVenue.get(venue)!
        cost += lotSize * netUnitPrice(snapshot.side, q.price, q.feeBps) * (snapshot.side === "buy" ? 1 : -1)
        used.set(venue, (used.get(venue) ?? 0) + lotSize)
      }
      for (const [venue, amt] of used.entries()) {
        const over = Math.max(0, amt - (capacity.get(venue) ?? 0))
        cost += over * 1e4
      }
      return snapshot.side === "buy" ? cost : -cost
    }

    let currentEnergy = energy(assignment)
    const T0 = 50
    for (let iter = 0; iter < scenario.annealingIterations; iter++) {
      const T = T0 * (1 - iter / scenario.annealingIterations)
      const i = Math.floor(rng() * numLots)
      const candidate = alive[Math.floor(rng() * alive.length)].venue
      const next = assignment.slice()
      next[i] = candidate
      const nextEnergy = energy(next)
      const delta = nextEnergy - currentEnergy
      if (delta <= 0 || rng() < Math.exp(-delta / Math.max(T, 1e-6))) {
        assignment = next
        currentEnergy = nextEnergy
      }
    }
    lineage.push({ step: "anneal", detail: `${scenario.annealingIterations} iterations`, at: new Date().toISOString() })

    const used = new Map<string, number>()
    for (const venue of assignment) if (venue) used.set(venue, (used.get(venue) ?? 0) + lotSize)
    // repair: trim any venue beyond capacity, dropping the overflow lots (reported as unfilled)
    let netCost = 0
    let filled = 0
    const allocations: RfqAllocation[] = []
    for (const [venue, amt] of used.entries()) {
      const q = quoteByVenue.get(venue)!
      const capped = Math.min(amt, capacity.get(venue) ?? 0)
      if (capped <= 1e-9) continue
      const unit = netUnitPrice(snapshot.side, q.price, q.feeBps)
      allocations.push({ venue, size: capped, price: q.price, feeBps: q.feeBps, netUnitPrice: unit })
      netCost += capped * unit
      filled += capped
    }
    lineage.push({ step: "repair", detail: "capped any over-capacity venue allocations", at: new Date().toISOString() })

    const benchmark = bestNominalBenchmark(snapshot.side, alive, snapshot.orderSize)
    const shortfallBps = benchmark.netCost !== 0
      ? ((snapshot.side === "buy" ? benchmark.netCost - netCost : netCost - benchmark.netCost) / Math.abs(benchmark.netCost)) * 10000
      : 0
    const tEnd = Date.now()

    const result: RfqResult = {
      side: snapshot.side,
      allocations,
      filled,
      orderSize: snapshot.orderSize,
      fillRate: filled / snapshot.orderSize,
      netCost,
      benchmarkNetCost: benchmark.netCost,
      benchmarkVenue: benchmark.venue,
      shortfallBps,
      latencyP50Ms: baseline.result.latencyP50Ms,
      latencyP95Ms: baseline.result.latencyP95Ms,
      fillPredictionAvailable: false,
      fillPredictionReason: baseline.result.fillPredictionReason,
    }
    const optimalityGapPct = baseline.result.netCost !== 0
      ? ((netCost - baseline.result.netCost) / Math.abs(baseline.result.netCost)) * 100 * (snapshot.side === "buy" ? 1 : -1)
      : null
    const kpis: RfqKpis = { costBps: shortfallBps, fillRate: result.fillRate, timeMs: tEnd - tStart, optimalityGapPct }

    return {
      available: true,
      result,
      kpis,
      executionMode: "quantum-inspired",
      solverActual: "simulated-annealing-lot-discretized",
      lineage,
      warnings,
    }
  },
}
