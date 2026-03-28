/**
 * Backend selection policy — wraps backend-selector logic with an auditable,
 * configurable policy layer.
 *
 * Policies:
 *   latency_first  – minimise latency (default)
 *   cost_first     – prefer cheapest backend
 *   capacity_first – prefer backend with most headroom
 *
 * Env var: BACKEND_POLICY (optional, defaults to latency_first)
 */

import {
  type Backend,
  selectOptimalBackend,
  selectBackendWithLatency,
} from "@/lib/backend-selector"

export type PolicyName = "latency_first" | "cost_first" | "capacity_first"

export interface PolicyInput {
  qubits: number
  depth: number
  gateCount: number
  shots: number
  targetLatency: number | null
  errorMitigation: string
  /** User/SDK hint — respected when not "auto" */
  backendHint: string | null
  /** Override the env-level policy for this call */
  policy?: PolicyName
}

export interface PolicyResult {
  backendId: Backend
  reason: string
  metadata: Record<string, unknown>
}

const VALID_POLICIES = new Set<PolicyName>([
  "latency_first",
  "cost_first",
  "capacity_first",
])

const VALID_BACKENDS = new Set<Backend>([
  "quantum_inspired_gpu",
  "hpc_gpu",
  "quantum_qpu",
])

/**
 * Cost ranking (lower = cheaper). Used by `cost_first` policy.
 */
const COST_RANK: Record<Backend, number> = {
  quantum_inspired_gpu: 1,
  hpc_gpu: 2,
  quantum_qpu: 3,
}

function resolvePolicy(override?: PolicyName): PolicyName {
  if (override && VALID_POLICIES.has(override)) return override
  const env = (process.env.BACKEND_POLICY ?? "").trim().toLowerCase()
  if (VALID_POLICIES.has(env as PolicyName)) return env as PolicyName
  return "latency_first"
}

/**
 * Select a backend using the active policy.  Pure function (no I/O).
 */
export function selectBackend(input: PolicyInput): PolicyResult {
  const policy = resolvePolicy(input.policy)
  const metrics = { qubits: input.qubits, depth: input.depth, gateCount: input.gateCount }
  const now = new Date().toISOString()

  // ── Manual override: user explicitly chose a backend ──────────────
  if (
    input.backendHint &&
    input.backendHint !== "auto" &&
    VALID_BACKENDS.has(input.backendHint as Backend)
  ) {
    const backend = input.backendHint as Backend
    return {
      backendId: backend,
      reason: `Manual selection: user requested ${backend}`,
      metadata: { policy, source: "manual", version: "1.0", timestamp: now },
    }
  }

  // ── Automatic selection via policy ────────────────────────────────
  let backendId: Backend
  let reason: string

  switch (policy) {
    case "latency_first": {
      backendId = selectBackendWithLatency(metrics, input.targetLatency, selectOptimalBackend(metrics))
      reason = `Latency-first: selected ${backendId} for ${input.qubits}q/${input.depth}d`
      if (input.targetLatency !== null) {
        reason += ` with target ${input.targetLatency}ms`
      }
      break
    }
    case "cost_first": {
      // Pick cheapest backend that can handle the workload
      const optimal = selectOptimalBackend(metrics)
      const candidates: Backend[] = ["quantum_inspired_gpu", "hpc_gpu", "quantum_qpu"]
      // Sort by cost and pick the first that is at least as capable
      candidates.sort((a, b) => COST_RANK[a] - COST_RANK[b])
      backendId = candidates.find((c) => COST_RANK[c] <= COST_RANK[optimal]) ?? optimal
      reason = `Cost-first: selected ${backendId} (cost rank ${COST_RANK[backendId]})`
      break
    }
    case "capacity_first": {
      // Prefer HPC GPU (most headroom), then quantum_inspired_gpu, then QPU
      if (input.qubits >= 20 || input.depth >= 100) {
        backendId = "hpc_gpu"
      } else if (input.qubits < 12) {
        backendId = "quantum_inspired_gpu"
      } else {
        backendId = "hpc_gpu"
      }
      reason = `Capacity-first: selected ${backendId} for headroom`
      break
    }
    default: {
      backendId = selectOptimalBackend(metrics)
      reason = `Fallback: selected ${backendId} via optimal selector`
    }
  }

  // Error-mitigation boost: if high mitigation requested, prefer HPC for stability
  if (input.errorMitigation === "high" && backendId === "quantum_qpu") {
    backendId = "hpc_gpu"
    reason += " | upgraded to hpc_gpu for high error-mitigation"
  }

  return {
    backendId,
    reason,
    metadata: { policy, source: "auto", version: "1.0", timestamp: now },
  }
}
