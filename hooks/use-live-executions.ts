/**
 * hooks/use-live-executions.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * React hook that opens an SSE connection to /api/quantum/stream and appends
 * incoming execution rows to local state.
 *
 * Usage:
 *   const { rows, connected, error, clear } = useLiveExecutions({
 *     enabled: sdkModeOn,
 *     digitalTwinId: "abc123",   // optional — omit for global feed
 *     initialRows: serverRows,   // pre-populate from existing DB query
 *   })
 */

"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { LIVE_CHANNEL } from "@/hooks/use-live-mode"

export interface ExecutionRow {
  id: string
  circuit_name: string
  algorithm: string
  status: string
  qubits_used: number
  runtime_ms: number
  success_rate: number
  backend_selected: string | null
  created_at: string
  digital_twin_id: string | null
  shots: number
  error_mitigation: string | null
  circuit_data: {
    source?: string
    fidelity?: number
    counts?: Record<string, number>
    [key: string]: unknown
  } | null
}

interface UseLiveExecutionsOptions {
  enabled: boolean
  digitalTwinId?: string | null
  initialRows?: ExecutionRow[]
  apiKey?: string | null
}

export function useLiveExecutions({
  enabled,
  digitalTwinId = null,
  initialRows = [],
  apiKey,
}: UseLiveExecutionsOptions) {
  const [rows, setRows] = useState<ExecutionRow[]>(initialRows)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const sinceRef = useRef<string>(
    initialRows.length > 0
      ? initialRows[initialRows.length - 1].created_at
      : new Date(0).toISOString()
  )

  const clear = useCallback(() => {
    setRows([])
    sinceRef.current = new Date(0).toISOString()
  }, [])

  useEffect(() => {
    // Merge initialRows into existing rows (don't replace — SSE-received rows must survive).
    // Only runs when the server provides more rows than before.
    setRows((prev) => {
      const prevIds = new Set(prev.map((r) => r.id))
      const fresh = initialRows.filter((r) => !prevIds.has(r.id))
      if (fresh.length === 0) return prev
      const merged = [...prev, ...fresh]
      merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      return merged.slice(-500)
    })
    if (initialRows.length > 0) {
      sinceRef.current = initialRows[initialRows.length - 1].created_at
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRows.length])

  // BroadcastChannel listener — always active regardless of `enabled`.
  // Runner broadcasts each completed execution so the dashboard (and any other
  // open panel) reflects it instantly without waiting for the 3-second SSE poll.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return
    const ch = new BroadcastChannel(LIVE_CHANNEL)
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== "execution_completed") return
      const row = event.data.row as ExecutionRow
      setRows((prev) => {
        if (prev.some((r) => r.id === row.id)) return prev
        const next = [row, ...prev].slice(0, 500)
        // advance sinceRef so SSE doesn't re-deliver this row
        if (row.created_at > sinceRef.current) sinceRef.current = row.created_at
        return next
      })
    }
    ch.addEventListener("message", handler)
    return () => {
      ch.removeEventListener("message", handler)
      ch.close()
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      if (esRef.current) {
        esRef.current.close()
        esRef.current = null
        setConnected(false)
      }
      return
    }

    const buildUrl = () => {
      const params = new URLSearchParams({ since: sinceRef.current })
      if (digitalTwinId) params.set("digital_twin_id", digitalTwinId)
      // Pass api_key as query param — EventSource cannot send custom headers
      if (apiKey) params.set("api_key", apiKey)
      return `/api/quantum/stream?${params.toString()}`
    }

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      if (esRef.current) { esRef.current.close(); esRef.current = null }

      const es = new EventSource(buildUrl())
      esRef.current = es

      es.onopen = () => {
        setConnected(true)
        setError(null)
      }

      es.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === "executions" && Array.isArray(msg.rows)) {
            const newRows: ExecutionRow[] = msg.rows
            if (newRows.length > 0) {
              sinceRef.current = newRows[newRows.length - 1].created_at
              setRows((prev) => {
                const ids = new Set(prev.map((r) => r.id))
                const fresh = newRows.filter((r) => !ids.has(r.id))
                if (fresh.length === 0) return prev
                return [...prev, ...fresh].slice(-500)
              })
            }
          } else if (msg.type === "error") {
            setError(msg.message)
          }
        } catch {
          // Ignore malformed events
        }
      }

      es.onerror = () => {
        setConnected(false)
        es.close()
        esRef.current = null
        // Reconnect after 5 s
        reconnectTimer = setTimeout(connect, 5_000)
      }
    }

    connect()

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer)
      esRef.current?.close()
      esRef.current = null
      setConnected(false)
    }
  }, [enabled, digitalTwinId, apiKey])

  return { rows, connected, error, clear }
}
