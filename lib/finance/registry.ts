/**
 * lib/finance/registry.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Central registry of finance twin modules. The core stays domain-agnostic —
 * new modules register here without touching API routes or persistence code.
 */
import type { FinanceModuleDefinition, FinanceModuleId } from "@/lib/finance/types"
import { riskScenarioModule } from "@/lib/finance/modules/risk-scenario"
import { collateralLiquidityModule } from "@/lib/finance/modules/collateral-liquidity"
import { executionRfqModule } from "@/lib/finance/modules/execution-rfq"

export const FINANCE_MODULES: Record<FinanceModuleId, FinanceModuleDefinition<any, any, any, any>> = {
  "risk-scenario": riskScenarioModule,
  "collateral-liquidity": collateralLiquidityModule,
  "execution-rfq": executionRfqModule,
}

export function getFinanceModule(moduleId: string): FinanceModuleDefinition<any, any, any, any> | null {
  return (FINANCE_MODULES as Record<string, FinanceModuleDefinition<any, any, any, any>>)[moduleId] ?? null
}

export function listFinanceModules() {
  return Object.values(FINANCE_MODULES).map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    clientProfile: m.clientProfile,
  }))
}
