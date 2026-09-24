/**
 * lib/finance/modules/risk-scenario.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Risk Scenario Twin — portfolio VaR/CVaR via historical simulation and
 * seeded Monte Carlo with antithetic variance reduction, benchmarked against
 * a closed-form parametric-normal reference.
 *
 * Loss convention: loss = -(portfolio return) * V0, so a POSITIVE number is a
 * loss and a NEGATIVE number is a gain. Quantiles/CVaR use linear
 * interpolation (see lib/finance/stats.ts) — documented because results are
 * sensitive to the quantile method with small/tied samples.
 *
 * Honesty notes:
 *  - The "experimental" route is NOT a real quantum/tensor-network
 *    implementation. It is reported as unavailable rather than faked.
 *  - This is a decision-support MVP, not a regulatory VaR certification.
 */
import { z } from "zod"
import type { FinanceModuleDefinition, LineageEntry } from "@/lib/finance/types"
import { mean, stddev, quantile, cvarAboveQuantile, correlation, normalInvCdf } from "@/lib/finance/stats"
import { covarianceFromCorrelation, cholesky, multiplyLowerTriangular, correlationMatrix } from "@/lib/finance/linalg"
import { makeGaussianSampler } from "@/lib/finance/random"

// ─── Schemas ─────────────────────────────────────────────────────────────────
export const RiskPositionSchema = z.object({
  symbol: z.string().min(1).max(32),
  quantity: z.number().finite(),
  price: z.number().finite().positive(),
  currency: z.string().length(3),
})

export const RiskSnapshotSchema = z.object({
  asOf: z.string().min(1),
  currency: z.string().length(3),
  positions: z.array(RiskPositionSchema).min(1).max(50),
  /** Chronologically-ordered per-symbol daily return series (oldest → newest), same length for every symbol. */
  returns: z.record(z.string(), z.array(z.number().finite())),
})
export type RiskSnapshotInput = z.infer<typeof RiskSnapshotSchema>

export const RiskScenarioSchema = z.object({
  horizonDays: z.number().int().min(1).max(252),
  confidenceLevel: z.number().gt(0.5).lt(1),
  // "monte-carlo" is temporarily disabled server-side: it reproducibly crashes the whole
  // Node process on the current production runtime (native SIGABRT, not a catchable JS
  // error) — never reproduced locally, root cause still under investigation. Rather than
  // risk taking the server down, only "historical" (verified safe) is accepted for now.
  method: z.enum(["historical", "monte-carlo"]).default("historical").refine(
    (m) => m === "historical",
    { message: "method 'monte-carlo' is temporarily unavailable pending a platform-level fix — use 'historical'" },
  ),
  numScenarios: z.number().int().min(200).max(5000).default(2000),
  /** Optional additive per-symbol return shock overlay (stress test), e.g. -0.1 = -10%. */
  shocks: z.record(z.string(), z.number().finite()).optional(),
})
export type RiskScenarioInput = z.infer<typeof RiskScenarioSchema>

export interface RiskResult {
  portfolioValue: number
  var: number
  cvar: number
  lossSamples: number
  confidenceLevel: number
  horizonDays: number
  varConfidenceInterval95: [number, number]
}

export interface RiskKpis {
  varErrorVsReferencePct: number
  cvarErrorVsReferencePct: number
  referenceVar: number
  referenceCvar: number
  scenariosUsed: number
  processMemoryDeltaBytes: number
  timeToTargetMs: number
}

function validateReturnsMatrix(snapshot: RiskSnapshotInput): { symbols: string[]; matrix: number[][] } {
  const symbols = snapshot.positions.map((p) => p.symbol)
  for (const p of snapshot.positions) {
    if (p.currency !== snapshot.currency) {
      throw new Error(
        `Position ${p.symbol} currency (${p.currency}) does not match snapshot currency (${snapshot.currency}). Multi-currency portfolios are out of scope for this MVP.`,
      )
    }
    if (!snapshot.returns[p.symbol]) {
      throw new Error(`Missing historical returns for position ${p.symbol}`)
    }
  }
  const lengths = new Set(symbols.map((s) => snapshot.returns[s].length))
  if (lengths.size > 1) {
    throw new Error("All symbols must have the same number of historical return observations (aligned time series)")
  }
  const n = snapshot.returns[symbols[0]].length
  if (n < 30) {
    throw new Error(`Insufficient sample size: ${n} observations (minimum 30 required for a meaningful VaR estimate)`)
  }
  const matrix = symbols.map((s) => snapshot.returns[s])
  return { symbols, matrix }
}

function computeWeights(snapshot: RiskSnapshotInput): { weights: number[]; v0: number } {
  const values = snapshot.positions.map((p) => p.quantity * p.price)
  const v0 = values.reduce((a, b) => a + b, 0)
  if (v0 === 0) throw new Error("Portfolio value is zero — cannot compute relative VaR/CVaR")
  const weights = values.map((v) => v / v0)
  return { weights, v0 }
}

/** Bootstrap resample (with replacement) to build an empirical 95% CI around a quantile estimate. */
function bootstrapVarCI(losses: number[], confidenceLevel: number, seed: number, resamples = 100): [number, number] {
  const n = losses.length
  const estimates: number[] = []
  // simple seeded LCG for index draws so bootstrap is reproducible without pulling in extra deps
  let state = (seed ^ 0x9e3779b9) >>> 0
  const nextIndex = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state % n
  }
  for (let b = 0; b < resamples; b++) {
    const sample: number[] = new Array(n)
    for (let i = 0; i < n; i++) sample[i] = losses[nextIndex()]
    estimates.push(quantile(sample, confidenceLevel))
  }
  return [quantile(estimates, 0.025), quantile(estimates, 0.975)]
}

export const riskScenarioModule: FinanceModuleDefinition<RiskSnapshotInput, RiskScenarioInput, RiskResult, RiskKpis> = {
  id: "risk-scenario",
  name: "Risk Scenario Twin",
  description: "Portfolio VaR/CVaR via historical simulation and seeded Monte Carlo with a parametric-normal reference.",
  clientProfile: "Wealthtechs, digital asset managers and risk teams needing reproducible scenario recompute.",

  parseSnapshot: (raw) => RiskSnapshotSchema.parse(raw),
  parseScenario: (raw) => RiskScenarioSchema.parse(raw),

  runClassical: (snapshot, scenario, seed) => {
    const memBefore = process.memoryUsage().heapUsed
    const tStart = Date.now()
    const lineage: LineageEntry[] = []
    const warnings: string[] = []

    const { symbols, matrix } = validateReturnsMatrix(snapshot)
    const { weights, v0 } = computeWeights(snapshot)
    lineage.push({ step: "validate", detail: `${symbols.length} positions, ${matrix[0].length} historical obs`, at: new Date().toISOString() })

    const shockedMatrix = matrix.map((series, i) => {
      const shock = scenario.shocks?.[symbols[i]] ?? 0
      return shock !== 0 ? series.map((r) => r + shock) : series
    })

    const horizonScale = Math.sqrt(scenario.horizonDays)
    let losses: number[]
    let solverActual: string

    if (scenario.method === "historical") {
      const nObs = shockedMatrix[0].length
      losses = []
      for (let t = 0; t < nObs; t++) {
        let portfolioReturn = 0
        for (let i = 0; i < weights.length; i++) portfolioReturn += weights[i] * shockedMatrix[i][t]
        losses.push(-v0 * portfolioReturn * horizonScale)
      }
      solverActual = "historical-simulation"
      if (nObs < scenario.numScenarios) {
        warnings.push(`Historical method reused ${nObs} observations (fewer than requested numScenarios=${scenario.numScenarios}); no synthetic history was fabricated.`)
      }
    } else {
      const means = shockedMatrix.map((s) => mean(s))
      const stds = shockedMatrix.map((s) => stddev(s))
      const corr = correlationMatrix(shockedMatrix, correlation)
      const cov = covarianceFromCorrelation(stds, corr)
      const L = cholesky(cov)
      const gauss = makeGaussianSampler(seed)

      // antithetic variates: draw n/2 base vectors, use +z and -z (real variance reduction, not cosmetic)
      const half = Math.ceil(scenario.numScenarios / 2)
      losses = []
      for (let s = 0; s < half; s++) {
        const z = symbols.map(() => gauss())
        const correlatedPos = multiplyLowerTriangular(L, z)
        const correlatedNeg = multiplyLowerTriangular(L, z.map((v) => -v))
        for (const correlated of [correlatedPos, correlatedNeg]) {
          let portfolioReturn = 0
          for (let i = 0; i < weights.length; i++) {
            const simReturn = (means[i] * scenario.horizonDays) + correlated[i] * horizonScale
            portfolioReturn += weights[i] * simReturn
          }
          losses.push(-v0 * portfolioReturn)
          if (losses.length >= scenario.numScenarios) break
        }
        if (losses.length >= scenario.numScenarios) break
      }
      solverActual = "monte-carlo-antithetic-cholesky"
      lineage.push({ step: "monte-carlo", detail: `${losses.length} seeded scenarios (antithetic pairs), seed=${seed}`, at: new Date().toISOString() })
    }

    const varEstimate = quantile(losses, scenario.confidenceLevel)
    const cvarEstimate = cvarAboveQuantile(losses, scenario.confidenceLevel)
    const ci = bootstrapVarCI(losses, scenario.confidenceLevel, seed)

    // Closed-form parametric-normal reference (independent cross-check, not the reported result)
    const means = shockedMatrix.map((s) => mean(s))
    const stds = shockedMatrix.map((s) => stddev(s))
    const corr = correlationMatrix(shockedMatrix, correlation)
    const cov = covarianceFromCorrelation(stds, corr)
    let muP = 0
    for (let i = 0; i < weights.length; i++) muP += weights[i] * means[i]
    let varP = 0
    for (let i = 0; i < weights.length; i++) {
      for (let j = 0; j < weights.length; j++) varP += weights[i] * weights[j] * cov[i][j]
    }
    const muPH = muP * scenario.horizonDays
    const sigmaPH = Math.sqrt(Math.max(varP, 0) * scenario.horizonDays)
    const z = normalInvCdf(scenario.confidenceLevel)
    const referenceVar = -v0 * muPH + v0 * sigmaPH * z
    const phi = Math.exp(-(z * z) / 2) / Math.sqrt(2 * Math.PI)
    const referenceCvar = -v0 * muPH + v0 * sigmaPH * (phi / (1 - scenario.confidenceLevel))

    const tEnd = Date.now()
    const memAfter = process.memoryUsage().heapUsed

    lineage.push({ step: "quantify", detail: `VaR=${varEstimate.toFixed(2)} CVaR=${cvarEstimate.toFixed(2)} @ ${(scenario.confidenceLevel * 100).toFixed(1)}%`, at: new Date().toISOString() })

    const result: RiskResult = {
      portfolioValue: v0,
      var: varEstimate,
      cvar: cvarEstimate,
      lossSamples: losses.length,
      confidenceLevel: scenario.confidenceLevel,
      horizonDays: scenario.horizonDays,
      varConfidenceInterval95: ci,
    }
    const kpis: RiskKpis = {
      varErrorVsReferencePct: referenceVar !== 0 ? (Math.abs(varEstimate - referenceVar) / Math.abs(referenceVar)) * 100 : 0,
      cvarErrorVsReferencePct: referenceCvar !== 0 ? (Math.abs(cvarEstimate - referenceCvar) / Math.abs(referenceCvar)) * 100 : 0,
      referenceVar,
      referenceCvar,
      scenariosUsed: losses.length,
      processMemoryDeltaBytes: Math.max(0, memAfter - memBefore),
      timeToTargetMs: tEnd - tStart,
    }

    return { result, kpis, solverActual, lineage, warnings }
  },

  // No real tensor-network / quantum-estimation backend is wired up yet.
  runExperimental: () => ({
    available: false,
    reason:
      "No validated tensor-network or quantum scenario-reduction backend is integrated in this pilot. Classical historical/Monte-Carlo baseline only.",
  }),
}
