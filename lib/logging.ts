import { createClient } from "@/lib/supabase/server"

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

export async function logExecution(log: ExecutionLog) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      console.error("[v0] User not authenticated for logging")
      return null
    }

    const { data, error } = await supabase
      .from("execution_logs")
      .insert({
        user_id: user.id,
        circuit_name: log.circuit_name || null,
        execution_type: log.execution_type,
        backend: log.backend,
        status: log.status,
        success_rate: log.success_rate || null,
        runtime_ms: log.runtime_ms || null,
        qubits_used: log.qubits_used || null,
        shots: log.shots || null,
        error_mitigation: log.error_mitigation || null,
        completed_at: log.status === "completed" || log.status === "failed" ? new Date().toISOString() : null,
      })
      .select()

    if (error) {
      console.error("[v0] Logging error:", error)
      return null
    }

    console.log("[v0] Execution logged:", data)
    return data
  } catch (error) {
    console.error("[v0] Logging exception:", error)
    return null
  }
}

export async function getExecutionHistory(limit = 10) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from("execution_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("[v0] Error fetching history:", error)
      return []
    }

    return data || []
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
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from("circuit_templates")
      .insert({
        user_id: user.id,
        name,
        description,
        qasm_code: qasmCode,
        qubits,
        gates,
      })
      .select()

    if (error) {
      console.error("[v0] Error saving template:", error)
      return null
    }

    return data
  } catch (error) {
    console.error("[v0] Exception saving template:", error)
    return null
  }
}
