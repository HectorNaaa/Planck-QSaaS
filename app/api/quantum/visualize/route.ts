import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import {
  validateApiKey,
  validateQASM,
  createSafeErrorResponse,
  validateRequestHeaders,
} from "@/lib/security"

export async function POST(request: NextRequest) {
  try {
    // Validate request headers
    const headerValidation = validateRequestHeaders(request.headers)
    if (!headerValidation.valid) {
      return NextResponse.json(
        { success: false, error: headerValidation.error },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Validate QASM
    const qasmValidation = validateQASM(body.qasm)
    if (!qasmValidation.valid) {
      return NextResponse.json(
        { success: false, error: qasmValidation.error },
        { status: 400 }
      )
    }
    const qasm = body.qasm
    
    // Authenticate via API key or session
    const apiKey = request.headers.get("x-api-key")
    const supabase = await createServerClient()
    
    if (apiKey) {
      // Validate API key format
      if (!validateApiKey(apiKey)) {
        return NextResponse.json(
          { success: false, error: "Invalid API key format" },
          { status: 401 }
        )
      }
      
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("api_key", apiKey)
        .single()
      
      if (profileError || !profile) {
        return NextResponse.json(
          { success: false, error: "Invalid API key" },
          { status: 401 }
        )
      }
    } else {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        return NextResponse.json(
          { success: false, error: "Unauthorized. Please provide an API key or authenticate." },
          { status: 401 }
        )
      }
    }

    // Parse QASM to extract gates and structure
    const circuitData = parseQASM(qasm)

    // Generate SVG visualization
    const svgImage = generateCircuitSVG(circuitData)

    return NextResponse.json({
      success: true,
      image_data: svgImage,
      format: "svg",
      stats: {
        gates: circuitData.gates.length,
        qubits: circuitData.numQubits,
        depth: circuitData.depth,
      },
      width: 800,
      height: Math.max(200, circuitData.numQubits * 60 + 60),
    })
  } catch (error) {
    const safeError = createSafeErrorResponse(error, "Failed to generate circuit visualization")
    console.error("[API] Visualization error:", error)
    return NextResponse.json(
      { success: false, error: safeError },
      { status: 500 }
    )
  }
}

interface Gate {
  type: string
  targets: number[]
  control?: number
  time: number
}

interface CircuitData {
  numQubits: number
  gates: Gate[]
  depth: number
}

function parseQASM(qasm: string): CircuitData {
  const lines = qasm.split("\n").filter((line) => line.trim() && !line.startsWith("//"))

  let numQubits = 0
  const gates: Gate[] = []
  const qubitTimes: number[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    // Parse qubit declaration
    if (trimmed.startsWith("qreg")) {
      const match = trimmed.match(/qreg\s+\w+\[(\d+)\]/)
      if (match) {
        numQubits = Number.parseInt(match[1])
        for (let i = 0; i < numQubits; i++) {
          qubitTimes[i] = 0
        }
      }
      continue
    }

    // Skip non-gate lines
    if (
      trimmed.startsWith("OPENQASM") ||
      trimmed.startsWith("include") ||
      trimmed.startsWith("creg") ||
      trimmed.includes("->")
    ) {
      continue
    }

    // Parse gates
    const gateMatch = trimmed.match(/^(\w+)\s+(.+);/)
    if (gateMatch) {
      const gateType = gateMatch[1]
      const params = gateMatch[2]

      let targets: number[] = []
      let control: number | undefined

      // Parse different gate formats
      if (params.includes(",")) {
        // CNOT or multi-qubit gate: cx q[0], q[1];
        const parts = params.split(",").map((p) => p.trim())
        parts.forEach((part, idx) => {
          const qubitMatch = part.match(/q\[(\d+)\]/)
          if (qubitMatch) {
            const qubit = Number.parseInt(qubitMatch[1])
            if (idx === 0 && (gateType === "cx" || gateType === "cnot")) {
              control = qubit
            } else {
              targets.push(qubit)
            }
          }
        })
      } else {
        // Single qubit gate: h q[0];
        const qubitMatch = params.match(/q\[(\d+)\]/)
        if (qubitMatch) {
          targets = [Number.parseInt(qubitMatch[1])]
        }
      }

      if (targets.length > 0 || control !== undefined) {
        const affectedQubits = control !== undefined ? [control, ...targets] : targets
        const maxTime = Math.max(...affectedQubits.map((q) => qubitTimes[q] || 0))

        gates.push({
          type: gateType,
          targets,
          control,
          time: maxTime,
        })

        // Update qubit times
        affectedQubits.forEach((q) => {
          qubitTimes[q] = maxTime + 1
        })
      }
    }
  }

  const depth = Math.max(...qubitTimes, 0)

  return { numQubits, gates, depth }
}

function generateCircuitSVG(circuit: CircuitData): string {
  const { numQubits, gates } = circuit
  const gateSpacing = 80
  const qubitSpacing = 60
  const leftMargin = 60
  const topMargin = 40
  const width = Math.max(800, gates.length * gateSpacing + leftMargin + 100)
  const height = numQubits * qubitSpacing + topMargin + 40

  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`

  // Background
  svg += `<rect width="${width}" height="${height}" fill="white"/>`

  // Draw qubit lines
  for (let i = 0; i < numQubits; i++) {
    const y = topMargin + i * qubitSpacing
    svg += `<line x1="${leftMargin}" y1="${y}" x2="${width - 40}" y2="${y}" stroke="#666" stroke-width="2"/>`
    svg += `<text x="20" y="${y + 5}" font-family="Arial" font-size="14" fill="#333">q[${i}]</text>`
  }

  // Draw gates
  const gatePositions: { [key: number]: number } = {}
  for (let i = 0; i < numQubits; i++) {
    gatePositions[i] = 0
  }

  gates.forEach((gate) => {
    const affectedQubits = gate.control !== undefined ? [gate.control, ...gate.targets] : gate.targets
    const maxPos = Math.max(...affectedQubits.map((q) => gatePositions[q]))

    const x = leftMargin + (maxPos + 1) * gateSpacing

    if (gate.control !== undefined) {
      // CNOT gate
      const controlY = topMargin + gate.control * qubitSpacing
      const targetY = topMargin + gate.targets[0] * qubitSpacing

      // Control dot
      svg += `<circle cx="${x}" cy="${controlY}" r="6" fill="#2563eb"/>`

      // Vertical line
      svg += `<line x1="${x}" y1="${controlY}" x2="${x}" y2="${targetY}" stroke="#2563eb" stroke-width="2"/>`

      // Target circle
      svg += `<circle cx="${x}" cy="${targetY}" r="15" fill="none" stroke="#2563eb" stroke-width="2"/>`
      svg += `<line x1="${x}" y1="${targetY - 15}" x2="${x}" y2="${targetY + 15}" stroke="#2563eb" stroke-width="2"/>`
      svg += `<line x1="${x - 15}" y1="${targetY}" x2="${x + 15}" y2="${targetY}" stroke="#2563eb" stroke-width="2"/>`
    } else {
      // Single qubit gates
      gate.targets.forEach((target) => {
        const y = topMargin + target * qubitSpacing

        // Gate box
        svg += `<rect x="${x - 20}" y="${y - 20}" width="40" height="40" fill="#10b981" stroke="#059669" stroke-width="2" rx="4"/>`

        // Gate label
        const label = gate.type.toUpperCase().slice(0, 3)
        svg += `<text x="${x}" y="${y + 5}" font-family="Arial" font-size="14" font-weight="bold" fill="white" text-anchor="middle">${label}</text>`
      })
    }

    // Update positions
    affectedQubits.forEach((q) => {
      gatePositions[q] = maxPos + 1
    })
  })

  svg += "</svg>"
  return svg
}
