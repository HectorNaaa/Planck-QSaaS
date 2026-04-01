"use server"

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

export async function logExecution(_log: ExecutionLog) {
  // Execution persistence is handled in API routes.
  return null
}

export async function getExecutionHistory(limit = 10) {
  try {
    void limit
    return []
  } catch (error) {
    console.error("[v0] Exception fetching history:", error)
    return []
  }
}

export async function saveCircuitTemplate(
  name: string,
  description: string,
  qasmCode: string,
  qubits: number,
  gates: number,
) {
  return {
    name,
    description,
    qasmCode,
    qubits,
    gates,
  }
}
