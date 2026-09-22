/**
 * __tests__/finance-collateral-liquidity.test.ts
 * Verifies the real Collateral & Liquidity Twin module — the min-cost-flow
 * baseline must be provably exact for a small, hand-verifiable instance.
 */
import { describe, it, expect } from "vitest"
import { collateralLiquidityModule } from "@/lib/finance/modules/collateral-liquidity"
import { buildCollateralLiquidityDemoSnapshot } from "@/lib/finance/demo-data"

describe("collateralLiquidityModule — exact min-cost-flow baseline", () => {
  it("funds the cheaper account first (hand-verifiable 2-account/1-obligation case)", () => {
    const snapshot = collateralLiquidityModule.parseSnapshot({
      asOf: "2026-09-19",
      currency: "USD",
      accounts: [
        { id: "A1", currency: "USD", balance: 1000, bufferReserve: 0, haircut: 0, transferLimit: 1000, costBps: 10 },
        { id: "A2", currency: "USD", balance: 1000, bufferReserve: 0, haircut: 0, transferLimit: 1000, costBps: 5 },
      ],
      obligations: [
        { id: "O1", currency: "USD", amountDue: 1500, cutoff: "2026-09-19T15:00:00Z", eligibleAccountIds: ["A1", "A2"] },
      ],
    })
    const scenario = collateralLiquidityModule.parseScenario({})
    const { result, kpis } = collateralLiquidityModule.runClassical(snapshot, scenario, 1)

    // Optimal: fill A2 (cheap, cap 1000) fully, then 500 from A1.
    // cost = (1000*5 + 500*10) / 10000 = 1.0
    expect(result.totalFunded).toBeCloseTo(1500, 6)
    expect(result.shortfall).toBeCloseTo(0, 6)
    expect(result.totalCost).toBeCloseTo(1.0, 6)
    expect(result.hardViolations).toHaveLength(0)
    expect(kpis.optimalityGapPct).toBe(0)

    const a2Alloc = result.allocations.find((a) => a.accountId === "A2")
    const a1Alloc = result.allocations.find((a) => a.accountId === "A1")
    expect(a2Alloc?.amount).toBeCloseTo(1000, 6)
    expect(a1Alloc?.amount).toBeCloseTo(500, 6)
  })

  it("reports an honest shortfall when capacity cannot cover demand under stress", () => {
    const snapshot = collateralLiquidityModule.parseSnapshot(buildCollateralLiquidityDemoSnapshot())
    const scenario = collateralLiquidityModule.parseScenario({ stressMultiplier: 5 })
    const { result } = collateralLiquidityModule.runClassical(snapshot, scenario, 1)
    expect(result.shortfall).toBeGreaterThan(0)
    expect(result.hardViolations).toHaveLength(0) // capacities are never violated, shortfall is reported instead
  })

  it("experimental annealing route is available, honestly labeled, and never beats the exact optimum", () => {
    const snapshot = collateralLiquidityModule.parseSnapshot(buildCollateralLiquidityDemoSnapshot())
    const scenario = collateralLiquidityModule.parseScenario({ annealingIterations: 2000 })
    const baseline = collateralLiquidityModule.runClassical(snapshot, scenario, 1)
    const experimental = collateralLiquidityModule.runExperimental(snapshot, scenario, 7, baseline)

    expect(experimental.available).toBe(true)
    if (experimental.available) {
      expect(experimental.executionMode).toBe("quantum-inspired")
      expect(experimental.kpis.optimalityGapPct).toBeGreaterThanOrEqual(-1e-6)
      expect(experimental.warnings.some((w) => /no qaoa|no qpu|classical simulated annealing/i.test(w))).toBe(true)
    }
  })
})
