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
import { getAdminClient } from "@/lib/supabase/admin"
import { authenticateRequest } from "@/lib/api-auth"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5-minute max on Vercel Pro; adjust as needed

export async function GET(req: NextRequest) {
  // Auth
  const auth = await authenticateRequest(req)
  if (!auth.success || !auth.userId) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const digitalTwinId = searchParams.get("digital_twin_id") ?? null
  let since = searchParams.get("since") ?? new Date(0).toISOString()

  const supabase = getAdminClient()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }
      const keepAlive = () => {
        controller.enqueue(encoder.encode(": ping\n\n"))
      }

      let open = true
      req.signal.addEventListener("abort", () => {
        open = false
        controller.close()
      })

      // Keep-alive every 15 s
      const kaInterval = setInterval(() => {
        if (!open) { clearInterval(kaInterval); return }
        keepAlive()
      }, 15_000)

      // Poll every 3 s
      const pollInterval = setInterval(async () => {
        if (!open) { clearInterval(pollInterval); return }

        try {
          let query = supabase
            .from("execution_logs")
            .select("id,circuit_name,algorithm,status,qubits_used,runtime_ms,success_rate,backend_selected,created_at,digital_twin_id,shots,error_mitigation,circuit_data")
            .eq("user_id", auth.userId!)
            .gt("created_at", since)
            .order("created_at", { ascending: true })
            .limit(50)

          if (digitalTwinId) {
            query = query.eq("digital_twin_id", digitalTwinId)
          }

          const { data: rows, error } = await query

          if (error) {
            send({ type: "error", message: error.message })
            return
          }

          if (rows && rows.length > 0) {
            since = rows[rows.length - 1].created_at
            send({ type: "executions", rows })
          }
        } catch (err: any) {
          send({ type: "error", message: err?.message ?? "Poll failed" })
        }
      }, 3_000)

      // Auto-close after maxDuration - 10 s to avoid hard cutoff
      setTimeout(() => {
        clearInterval(kaInterval)
        clearInterval(pollInterval)
        if (open) { controller.close() }
      }, (maxDuration - 10) * 1_000)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
