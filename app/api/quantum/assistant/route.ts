import { streamText, convertToModelMessages } from "ai"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: Request) {
  try {
    const { messages, userId } = await req.json()

    // Fetch user's execution history for context
    let executionContext = ""
    if (userId) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

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

    const result = streamText({
      model: "openai/gpt-4o-mini",
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      maxTokens: 500,
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Failed to process request" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
