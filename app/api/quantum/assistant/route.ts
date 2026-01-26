import { type NextRequest, NextResponse } from "next/server"
import { streamText } from "ai"
import { createServerClient } from "@/lib/supabase/server"
import {
  validateApiKey,
  sanitizeString,
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
    const { messages, includeHistory } = body

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: "Messages array is required" },
        { status: 400 }
      )
    }

    // Sanitize messages
    const sanitizedMessages = messages.map((msg: any) => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: sanitizeString(msg.content, 5000),
    }))

    // Check for API key authentication
    const apiKey = request.headers.get("x-api-key")
    const supabase = await createServerClient()
    let userId: string | null = null

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
      userId = profile.id
    } else {
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json(
          { success: false, error: "Unauthorized. Please provide an API key or authenticate." },
          { status: 401 }
        )
      }
      userId = user.id
    }

    // Fetch user's execution history for context if requested
    let executionContext = ""
    if (includeHistory !== false && userId) {
      try {
        const { data: recentExecutions } = await supabase
          .from("execution_logs")
          .select("circuit_name, algorithm, qubits_used, runtime_ms, status, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(10)

        if (recentExecutions && recentExecutions.length > 0) {
          executionContext = `
User's recent quantum executions:
${recentExecutions.map((e, i) =>
  `${i + 1}. "${e.circuit_name}" - ${e.algorithm || "Custom"} algorithm, ${e.qubits_used} qubits, ${e.runtime_ms?.toFixed(3) || "N/A"}ms runtime, status: ${e.status}`
).join("\n")}
`
        }
      } catch (historyError) {
        console.error("[API] Error fetching execution history:", historyError)
        // Continue without history
      }
    }

    const systemPrompt = `You are Planck Assistant, a helpful AI specialized in quantum computing and quantum digital twins. You help users understand:

1. Quantum computing concepts (qubits, superposition, entanglement, quantum gates)
2. Quantum algorithms (VQE, QAOA, Grover, Shor, QFT, QSVM)
3. Digital twins and their quantum applications
4. How to optimize quantum circuits
5. Interpretation of their execution results

Keep responses concise (2-4 sentences for simple questions, up to a paragraph for complex topics). Use analogies when helpful. If asked about the user's executions, reference their history below.

${executionContext}

Important guidelines:
- Be helpful and encouraging about quantum computing
- Explain complex concepts in accessible terms
- Reference the user's actual executions when relevant
- Suggest optimizations based on their usage patterns
- Stay focused on quantum computing topics`

    // Use streaming response
    const result = streamText({
      model: "openai/gpt-4o-mini",
      system: systemPrompt,
      messages: sanitizedMessages,
      maxTokens: 500,
    })

    return result.toTextStreamResponse()
  } catch (error) {
    const safeError = createSafeErrorResponse(error, "Failed to process assistant request")
    console.error("[API] Assistant error:", error)
    return NextResponse.json(
      { success: false, error: safeError },
      { status: 500 }
    )
  }
}
