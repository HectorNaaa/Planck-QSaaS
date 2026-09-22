/**
 * lib/finance/demo-data.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Small, deterministic, reproducible demo snapshots for each finance twin.
 * ALL data here is synthetic (`isSynthetic: true`) and must never be
 * presented as real market/portfolio/treasury data. Generated from a fixed
 * seed so the same demo always produces the same numbers.
 */
import { makeGaussianSampler } from "@/lib/finance/random"
import type { RiskSnapshotInput } from "@/lib/finance/modules/risk-scenario"
import type { CollateralSnapshotInput } from "@/lib/finance/modules/collateral-liquidity"
import type { RfqSnapshotInput } from "@/lib/finance/modules/execution-rfq"

export const DEMO_SEED = 424242

export function buildRiskScenarioDemoSnapshot(): RiskSnapshotInput {
  const gauss = makeGaussianSampler(DEMO_SEED)
  const nObs = 60
  const assets = [
    { symbol: "DEMO_EQ_A", price: 100, quantity: 500, dailyVol: 0.014, dailyMean: 0.0003 },
    { symbol: "DEMO_EQ_B", price: 45, quantity: 1200, dailyVol: 0.021, dailyMean: 0.0002 },
    { symbol: "DEMO_BOND_C", price: 98, quantity: 800, dailyVol: 0.004, dailyMean: 0.0001 },
  ]
  const returns: Record<string, number[]> = {}
  for (const a of assets) {
    returns[a.symbol] = Array.from({ length: nObs }, () => a.dailyMean + a.dailyVol * gauss())
  }
  return {
    asOf: "2026-09-19",
    currency: "USD",
    positions: assets.map((a) => ({ symbol: a.symbol, quantity: a.quantity, price: a.price, currency: "USD" })),
    returns,
  }
}

export function buildCollateralLiquidityDemoSnapshot(): CollateralSnapshotInput {
  return {
    asOf: "2026-09-19",
    currency: "USD",
    accounts: [
      { id: "ACC_CASH_1", currency: "USD", balance: 500_000, bufferReserve: 0.1, haircut: 0, transferLimit: 400_000, costBps: 2 },
      { id: "ACC_CASH_2", currency: "USD", balance: 250_000, bufferReserve: 0.05, haircut: 0, transferLimit: 250_000, costBps: 3 },
      { id: "ACC_SECURITIES_1", currency: "USD", balance: 300_000, bufferReserve: 0, haircut: 0.15, transferLimit: 300_000, costBps: 6 },
    ],
    obligations: [
      { id: "OBL_SETTLEMENT_1", currency: "USD", amountDue: 320_000, cutoff: "2026-09-19T15:00:00Z", eligibleAccountIds: ["ACC_CASH_1", "ACC_CASH_2"] },
      { id: "OBL_MARGIN_CALL_1", currency: "USD", amountDue: 180_000, cutoff: "2026-09-19T17:00:00Z", eligibleAccountIds: ["ACC_CASH_1", "ACC_SECURITIES_1"] },
      { id: "OBL_PAYROLL_1", currency: "USD", amountDue: 90_000, cutoff: "2026-09-19T20:00:00Z", eligibleAccountIds: ["ACC_CASH_2", "ACC_SECURITIES_1"] },
    ],
  }
}

/**
 * Demo RFQ snapshot deliberately includes a venue with the best headline price
 * but a high fee, so the naive "best nominal price" benchmark does NOT yield
 * the best net result — matching the explicit acceptance requirement.
 */
export function buildExecutionRfqDemoSnapshot(): RfqSnapshotInput {
  const baseTs = "2026-09-19T12:00:00Z"
  return {
    asOf: baseTs,
    side: "buy",
    orderSize: 10_000,
    quotes: [
      { venue: "VENUE_A_CHEAP_HEADLINE", price: 10.00, size: 4_000, feeBps: 35, timestamp: baseTs, ttlMs: 60_000, latencyMs: 42 },
      { venue: "VENUE_B_LOW_FEE", price: 10.02, size: 6_000, feeBps: 2, timestamp: baseTs, ttlMs: 60_000, latencyMs: 58 },
      { venue: "VENUE_C_MID", price: 10.01, size: 3_000, feeBps: 15, timestamp: baseTs, ttlMs: 60_000, latencyMs: 71 },
    ],
  }
}
