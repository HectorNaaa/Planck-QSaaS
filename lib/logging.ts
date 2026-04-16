"use server"

import { Executions } from "@/lib/db/client"

export interface ExecutionLog {
  circuit_name?: string
  execution_type: "auto" | "manual" | "template"
  backend: "quantum_inspired_gpu" | "hpc_gpu" | "quantum_qpu"
  status: "pending" | "running" | "completed" | "failed"
  success_rate?: number
  runtime_ms?: number
  qubits_used?: number
  shots?: number
  error_mitigation?: "none" | "low" | "medium" | "high"
  error?: string
}

export async function logExecution(userId: string, log: ExecutionLog) {
  try {
    if (!userId) {
      console.error("[logging] No userId provided")
      return null
    }

    const result = Executions.create({
      user_id: userId,
      circuit_name: log.circuit_name,
      execution_type: log.execution_type,
      backend: log.backend,
      status: log.status,
      success_rate: log.success_rate,
      runtime_ms: log.runtime_ms,
      qubits_used: log.qubits_used,
      shots: log.shots,
      error_mitigation: log.error_mitigation,
      error: log.error,
    })

    console.log("[logging] Execution logged:", result.id)
    return result
  } catch (err) {
    console.error("[logging] logExecution exception:", err)
    return null
  }
}

export async function getExecutionHistory(userId: string, limit = 10) {
  try {
    if (!userId) return []

    const rows = Executions.findByUserId(userId)
    return rows.slice(0, limit)
  } catch (err) {
    console.error("[logging] getExecutionHistory exception:", err)
    return []
  }
}

export async function saveCircuitTemplate(
  _userId: string,
  _name: string,
  _description: string,
  _qasmCode: string,
  _qubits: number,
  _gates: number,
): Promise<null> {
  // circuit_templates table not yet implemented in internal DB
  console.warn("[logging] saveCircuitTemplate: not implemented")
  return null
}
