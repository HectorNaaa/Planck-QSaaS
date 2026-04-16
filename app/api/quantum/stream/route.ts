/**
 * app/api/quantum/stream/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-Sent Events (SSE) endpoint for real-time dashboard updates.
 *
 * When the user enables "SDK mode" (intensive-use toggle) in the runner, the
 * client connects to this route. Every 3 seconds the server polls
 * `execution_logs` for rows newer than the last seen `created_at` and pushes
 * any new rows as JSON events. This avoids the 30-second serverless timeout by
 * running a long-lived, non-serverless streaming response via the Web Streams
 * API with a keep-alive comment every 15 s.
 *
 * Query params:
 *   digital_twin_id  (optional) — filter to a specific DT
 *   since            (optional) — ISO timestamp; only rows newer than this
 */

import { type NextRequest } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { ApiKeys, Executions } from "@/lib/db/client"
import { validateApiKey } from "@/lib/security"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // EventSource cannot send headers — accept api_key as query param as fallback.
  // Priority: x-api-key header (SDK) → api_key query param (browser EventSource).
  const queryApiKey = searchParams.get("api_key")
  let userId: string | null = null

  if (queryApiKey && validateApiKey(queryApiKey)) {
    const keyRow = ApiKeys.findByKey(queryApiKey)
    if (keyRow) userId = keyRow.user_id
  }

  if (!userId) {
    // Fallback to header / session auth
    const auth = await authenticateRequest(req)
    if (!auth.ok || !auth.userId) {
      return new Response("Unauthorized", { status: 401 })
    }
    userId = auth.userId
  }

  const digitalTwinId = searchParams.get("digital_twin_id") ?? null
  let since = searchParams.get("since") ?? new Date(0).toISOString()

  const encoder = new TextEncoder()

  /** Convert a raw SQLite row to the client ExecutionRow shape. */
  function toClientRow(r: any) {
    let parsed: any = null
    try { parsed = r.circuit_data ? JSON.parse(r.circuit_data) : null } catch { /* keep null */ }
    return {
      id:               r.id,
      circuit_name:     r.circuit_name   ?? '',
      algorithm:        r.algorithm      ?? '',
      status:           r.status         ?? 'pending',
      qubits_used:      r.qubits_used    ?? 0,
      runtime_ms:       r.runtime_ms     ?? 0,
      success_rate:     r.success_rate   ?? 0,
      backend_selected: r.backend_selected ?? null,
      created_at:       new Date(r.created_at ?? Date.now()).toISOString(),
      digital_twin_id:  parsed?.digital_twin_id ?? null,
      shots:            r.shots          ?? 0,
      error_mitigation: r.error_mitigation ?? null,
      circuit_data: parsed ? {
        source:  parsed.source,
        fidelity: parsed.results?.fidelity ?? null,
        counts:   parsed.results?.counts   ?? null,
      } : null,
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch { /* stream closed */ }
      }

      let open = true
      req.signal.addEventListener("abort", () => {
        open = false
        try { controller.close() } catch { /* already closed */ }
      })

      // Keep-alive ping every 15 s
      const kaInterval = setInterval(() => {
        if (!open) { clearInterval(kaInterval); return }
        try { controller.enqueue(encoder.encode(": ping\n\n")) } catch { /* closed */ }
      }, 15_000)

      // Poll every 3 s
      const pollInterval = setInterval(async () => {
        if (!open) { clearInterval(pollInterval); return }
        try {
          const raw = Executions.findByUserIdSince(userId!, since, digitalTwinId)
          if (raw.length > 0) {
            const rows = raw.map(toClientRow)
            since = rows[rows.length - 1].created_at
            send({ type: "executions", rows })
          }
        } catch (e) {
          // DB errors are non-fatal — retry on next tick
        }
      }, 3_000)

      // Auto-close before hard Vercel timeout
      setTimeout(() => {
        clearInterval(kaInterval)
        clearInterval(pollInterval)
        open = false
        try { controller.close() } catch { /* already closed */ }
      }, (maxDuration - 10) * 1_000)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
