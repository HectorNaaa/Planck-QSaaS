/**
 * app/api/quantum/generate-circuit/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/quantum/generate-circuit
 *
 * Generates a parametric OpenQASM 2.0 circuit shaped by the caller's data.
 * All circuit construction is delegated to lib/circuit-builder.ts via
 * lib/qasm-processor.ts — no inline QASM strings live in this file.
 */

import { type NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import {
  validateAlgorithm,
  validateQubits,
  validateInputData,
  createSafeErrorResponse,
  validateRequestHeaders,
} from "@/lib/security"
import { generateCircuit } from "@/lib/qasm-processor"

export async function POST(request: NextRequest) {
  try {
    const headerValidation = validateRequestHeaders(request.headers)
    if (!headerValidation.valid) {
      return NextResponse.json(
        { success: false, error: headerValidation.error },
        { status: 403 },
      )
    }

    const body = await request.json()

    const algorithm = validateAlgorithm(body.algorithm)
    // qubits hint is forwarded inside inputData; route-level param kept for
    // backwards compat but circuit-builder derives its own from the data.
    validateQubits(body.qubits ?? 2)

    const inputDataValidation = validateInputData(body.inputData)
    if (!inputDataValidation.valid) {
      return NextResponse.json(
        { success: false, error: inputDataValidation.error },
        { status: 400 },
      )
    }

    const auth = await authenticateRequest(request)
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status },
      )
    }

    const circuit = await generateCircuit(algorithm, inputDataValidation.data)

    return NextResponse.json({
      success: true,
      qasm:             circuit.qasm,
      qubits:           circuit.qubits,
      depth:            circuit.depth,
      gateCount:        circuit.gate_count,
      gates:            circuit.gates,
      recommendedShots: circuit.recommended_shots,
      paramSummary:     circuit.paramSummary,
      transpiled:       circuit.transpiled,
    })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, "Failed to generate circuit")
    console.error("[API] Circuit generation error:", error)
    return NextResponse.json({ success: false, error: safeError }, { status: 500 })
  }
}
