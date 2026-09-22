/**
 * __tests__/finance-execution-rfq.test.ts
 * Verifies the real Execution/RFQ Twin module — including the required
 * scenario where the best HEADLINE price does not yield the best NET result.
 */
import { describe, it, expect } from "vitest"
import { executionRfqModule } from "@/lib/finance/modules/execution-rfq"
import { buildExecutionRfqDemoSnapshot } from "@/lib/finance/demo-data"

describe("executionRfqModule — greedy net-price allocation vs naive nominal-price benchmark", () => {
  it("beats the best-nominal-price benchmark once fees are accounted for", () => {
    const snapshot = executionRfqModule.parseSnapshot(buildExecutionRfqDemoSnapshot())
    const scenario = executionRfqModule.parseScenario({ decisionTime: "2026-09-19T12:00:30Z" })
    const { result, kpis } = executionRfqModule.runClassical(snapshot, scenario, 1)

    // VENUE_A has the cheapest headline price but a high fee — the naive
    // benchmark routes to it first; our net-price ranking should do better.
    expect(result.benchmarkVenue).toBe("VENUE_A_CHEAP_HEADLINE")
    expect(result.fillRate).toBeCloseTo(1, 6)
    expect(result.netCost).toBeLessThan(result.benchmarkNetCost)
    expect(result.shortfallBps).toBeGreaterThan(0)
    expect(kpis.optimalityGapPct).toBe(0)

    // Hand-computed net costs (see module docstring for the pricing formula).
    expect(result.netCost).toBeCloseTo(100242.069, 2)
    expect(result.benchmarkNetCost).toBeCloseTo(100281.057, 2)
  })

  it("excludes expired quotes at the replay decision time", () => {
    const snapshot = executionRfqModule.parseSnapshot(buildExecutionRfqDemoSnapshot())
    // 5 minutes after all quotes' 60s TTL has elapsed -> nothing alive.
    const scenario = executionRfqModule.parseScenario({ decisionTime: "2026-09-19T12:05:00Z" })
    expect(() => executionRfqModule.runClassical(snapshot, scenario, 1)).toThrow(/no quotes are alive/i)
  })

  it("does not fabricate a fill-rate prediction", () => {
    const snapshot = executionRfqModule.parseSnapshot(buildExecutionRfqDemoSnapshot())
    const scenario = executionRfqModule.parseScenario({ decisionTime: "2026-09-19T12:00:30Z" })
    const { result } = executionRfqModule.runClassical(snapshot, scenario, 1)
    expect(result.fillPredictionAvailable).toBe(false)
  })

  it("experimental annealing route is honestly labeled quantum-inspired (classical)", () => {
    const snapshot = executionRfqModule.parseSnapshot(buildExecutionRfqDemoSnapshot())
    const scenario = executionRfqModule.parseScenario({ decisionTime: "2026-09-19T12:00:30Z", lotSize: 500 })
    const baseline = executionRfqModule.runClassical(snapshot, scenario, 1)
    const experimental = executionRfqModule.runExperimental(snapshot, scenario, 3, baseline)
    expect(experimental.available).toBe(true)
    if (experimental.available) {
      expect(experimental.executionMode).toBe("quantum-inspired")
      expect(experimental.warnings.some((w) => /qaoa|qpu/i.test(w))).toBe(true)
    }
  })
})
