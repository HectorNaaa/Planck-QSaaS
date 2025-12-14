import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { qasm, shots, backend, errorMitigation, circuitName, algorithm, executionType, qubits } = body

    console.log("[v0] Simulating quantum circuit:", { backend, shots, errorMitigation })

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("[v0] Authentication error:", authError)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Simulate quantum execution
    const results = await simulateQuantumCircuit({
      qasm,
      shots,
      backend,
      errorMitigation,
    })

    const { data: insertedLog, error: insertError } = await supabase
      .from("execution_logs")
      .insert({
        user_id: user.id,
        circuit_name: circuitName || "Unnamed Circuit",
        algorithm: algorithm || "Unknown",
        execution_type: executionType || "auto",
        backend,
        status: "completed",
        success_rate: results.successRate,
        runtime_ms: results.runtime,
        qubits_used: qubits || extractQubitCount(qasm),
        shots,
        error_mitigation: errorMitigation,
        circuit_data: {
          qasm_code: qasm,
          results: {
            counts: results.counts,
            success_rate: results.successRate,
            runtime_ms: results.runtime,
            memory: results.memory,
          },
          backend_config: {
            backend,
            shots,
            error_mitigation: errorMitigation,
          },
        },
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (insertError) {
      console.error("[v0] Failed to save execution to Supabase:", insertError)
    } else {
      console.log("[v0] Execution saved to Supabase successfully with ID:", insertedLog?.id)
    }

    return NextResponse.json({
      success: true,
      counts: results.counts,
      successRate: results.successRate,
      runtime: results.runtime,
      memory: results.memory,
      execution_id: insertedLog?.id,
    })
  } catch (error) {
    console.error("[v0] Simulation error:", error)
    return NextResponse.json({ success: false, error: "Failed to simulate circuit" }, { status: 500 })
  }
}

async function simulateQuantumCircuit(config: any) {
  const { shots, backend, errorMitigation } = config

  const counts: Record<string, number> = {}
  const qubits = extractQubitCount(config.qasm)

  for (let i = 0; i < shots; i++) {
    let outcome = ""
    for (let q = 0; q < qubits; q++) {
      let prob = 0.5
      if (backend === "quantum_qpu") {
        prob += (Math.random() - 0.5) * 0.2
      }
      outcome += Math.random() < prob ? "1" : "0"
    }
    counts[outcome] = (counts[outcome] || 0) + 1
  }

  if (errorMitigation !== "none") {
    const mitigationFactor =
      {
        low: 0.05,
        medium: 0.1,
        high: 0.15,
      }[errorMitigation] || 0

    Object.keys(counts).forEach((key) => {
      counts[key] = Math.floor(counts[key] * (1 + mitigationFactor * Math.random()))
    })
  }

  const totalShots = Object.values(counts).reduce((a, b) => a + b, 0)
  const maxCount = Math.max(...Object.values(counts))
  const successRate = (maxCount / totalShots) * 100

  const runtime = 100 + Math.random() * 400

  return {
    counts,
    successRate,
    runtime,
    memory: Object.keys(counts),
  }
}

function extractQubitCount(qasm: string): number {
  const match = qasm.match(/qreg q\[(\d+)\]/)
  return match ? Number.parseInt(match[1]) : 4
}
