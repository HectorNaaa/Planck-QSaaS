/**
 * __tests__/finance-risk-scenario.test.ts
 * Verifies the real Risk Scenario Twin module (lib/finance/modules/risk-scenario.ts)
 * against independently hand-computed reference values, not a re-implementation.
 */
import { describe, it, expect } from "vitest"
import { riskScenarioModule } from "@/lib/finance/modules/risk-scenario"

describe("riskScenarioModule — historical VaR/CVaR (exact hand-verified case)", () => {
  it("matches an independently computed linear-interpolation quantile", () => {
    // Single asset -> portfolio weight = 1, so loss_t = -V0 * return_t.
    // returns[i] = (i - 15) / 1000 for i in 0..29 => loss_t = 15 - i (integers -14..15).
    const returns = Array.from({ length: 30 }, (_, i) => (i - 15) / 1000)
    const snapshot = riskScenarioModule.parseSnapshot({
      asOf: "2026-09-19",
      currency: "USD",
      positions: [{ symbol: "X", quantity: 100, price: 10, currency: "USD" }], // V0 = 1000
      returns: { X: returns },
    })
    const scenario = riskScenarioModule.parseScenario({
      horizonDays: 1,
      confidenceLevel: 0.95,
      method: "historical",
      numScenarios: 200,
    })

    const { result } = riskScenarioModule.runClassical(snapshot, scenario, 1)

    // Independently computed: sorted losses = -14..15 (arithmetic, step 1).
    // idx = 0.95 * 29 = 27.55 -> lo=27 (value 13), hi=28 (value 14), frac=0.55
    // VaR = 13*0.45 + 14*0.55 = 13.55
    // CVaR = mean of losses >= 13.55 -> {14, 15} -> 14.5
    expect(result.var).toBeCloseTo(13.55, 6)
    expect(result.cvar).toBeCloseTo(14.5, 6)
    expect(result.lossSamples).toBe(30)
    expect(result.portfolioValue).toBe(1000)
  })

  it("rejects portfolios with mismatched position currency", () => {
    const snapshot = riskScenarioModule.parseSnapshot({
      asOf: "2026-09-19",
      currency: "USD",
      positions: [{ symbol: "X", quantity: 10, price: 10, currency: "EUR" }],
      returns: { X: Array(30).fill(0.01) },
    })
    const scenario = riskScenarioModule.parseScenario({ horizonDays: 1, confidenceLevel: 0.95, method: "historical" })
    expect(() => riskScenarioModule.runClassical(snapshot, scenario, 1)).toThrow(/currency/i)
  })

  it("rejects insufficient sample sizes (<30 observations)", () => {
    const snapshot = riskScenarioModule.parseSnapshot({
      asOf: "2026-09-19",
      currency: "USD",
      positions: [{ symbol: "X", quantity: 10, price: 10, currency: "USD" }],
      returns: { X: Array(10).fill(0.01) },
    })
    const scenario = riskScenarioModule.parseScenario({ horizonDays: 1, confidenceLevel: 0.95, method: "historical" })
    expect(() => riskScenarioModule.runClassical(snapshot, scenario, 1)).toThrow(/Insufficient sample/i)
  })
})

describe("riskScenarioModule — Monte Carlo (seeded reproducibility + reference cross-check)", () => {
  const returns30 = (mean: number, i: number) => mean + 0.01 * Math.sin(i)
  const snapshot = riskScenarioModule.parseSnapshot({
    asOf: "2026-09-19",
    currency: "USD",
    positions: [{ symbol: "A", quantity: 10, price: 100, currency: "USD" }, { symbol: "B", quantity: 20, price: 50, currency: "USD" }],
    returns: {
      A: Array.from({ length: 60 }, (_, i) => returns30(0.0003, i)),
      B: Array.from({ length: 60 }, (_, i) => returns30(0.0002, i + 7)),
    },
  })
  const scenario = riskScenarioModule.parseScenario({ horizonDays: 5, confidenceLevel: 0.95, method: "monte-carlo", numScenarios: 2000 })

  it("is exactly reproducible given the same seed", () => {
    const runA = riskScenarioModule.runClassical(snapshot, scenario, 12345)
    const runB = riskScenarioModule.runClassical(snapshot, scenario, 12345)
    expect(runA.result).toEqual(runB.result)
  })

  it("stays reasonably close to the closed-form parametric-normal reference", () => {
    const { result, kpis } = riskScenarioModule.runClassical(snapshot, scenario, 999)
    expect(result.lossSamples).toBe(2000)
    expect(Number.isFinite(kpis.varErrorVsReferencePct)).toBe(true)
    // Generous bound: MC sampling error against a normal-approximation reference.
    expect(kpis.varErrorVsReferencePct).toBeLessThan(60)
  })

  it("reports the experimental route as unavailable rather than fabricating a result", () => {
    const baseline = riskScenarioModule.runClassical(snapshot, scenario, 1)
    const experimental = riskScenarioModule.runExperimental(snapshot, scenario, 1, baseline)
    expect(experimental.available).toBe(false)
  })
})
