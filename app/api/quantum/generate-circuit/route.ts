/**
 * app/api/quantum/generate-circuit/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/quantum/generate-circuit
 *
 * Generates a parametric OpenQASM 2.0 circuit shaped by the caller's data.
 * All circuit construction is delegated to lib/circuit-builder.ts via
 * lib/qasm-processor.ts — no inline QASM strings live in this file.
 *
 * Optional body fields (forwarded as BuildOptions):
 *   maxQubits   – hard cap 2-20 overriding auto-derived count
 *   maxDepth    – limit circuit depth / ansatz layers
 *   angleScale  – multiply all rotation angles (default 1.0)
 *   forceLayers – override VQE/QAOA layer count
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
import type { BuildOptions } from "@/lib/circuit-builder"

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

    // Extract optional build hints from the request body
    // Supports flat fields (UI) or nested buildOptions object (SDK)
    const bo = body.buildOptions ?? {}
    const opts: BuildOptions = {}
    const maxQubits   = body.maxQubits   ?? bo.maxQubits
    const maxDepth    = body.maxDepth    ?? bo.maxDepth
    const angleScale  = body.angleScale  ?? bo.angleScale
    const forceLayers = body.forceLayers ?? bo.forceLayers
    const sampleHint  = body.sampleCountHint ?? bo.sampleCountHint
    if (typeof maxQubits   === "number") opts.maxQubits        = Math.min(20, Math.max(2, maxQubits))
    if (typeof maxDepth    === "number") opts.maxDepth         = Math.max(1, maxDepth)
    if (typeof angleScale  === "number") opts.angleScale       = angleScale
    if (typeof forceLayers === "number") opts.forceLayers      = Math.max(1, forceLayers)
    if (typeof sampleHint  === "number") opts.sampleCountHint  = Math.max(1, sampleHint)

    const circuit = await generateCircuit(algorithm, inputDataValidation.data, opts)

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
      dataScale:        circuit.dataScale,
      layers:           circuit.layers,
    })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, "Failed to generate circuit")
    console.error("[API] Circuit generation error:", error)
    return NextResponse.json({ success: false, error: safeError }, { status: 500 })
  }
}
