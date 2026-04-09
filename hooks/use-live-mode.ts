/**
 * hooks/use-live-mode.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared live-mode toggle used by both the runner and the dashboard.
 *
 * State is kept in sessionStorage under "planck_sdk_mode" so it survives page
 * navigation within the same browser tab.  A BroadcastChannel ("planck_live")
 * propagates changes to other tabs/pages open at the same time.
 *
 * Usage:
 *   const [liveEnabled, setLiveEnabled] = useLiveMode(isGuest)
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import type { ExecutionRow } from "@/hooks/use-live-executions"

export const LIVE_CHANNEL = "planck_live"
const STORAGE_KEY = "planck_sdk_mode"

export function useLiveMode(isGuest: boolean = false): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState(false)

  // Hydrate from sessionStorage on mount (client-only)
  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") setEnabled(true)
    } catch {
      // sessionStorage unavailable — stay false
    }
  }, [])

  // Listen for live_mode_changed from other pages / tabs
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return
    const ch = new BroadcastChannel(LIVE_CHANNEL)
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "live_mode_changed") {
        setEnabled(event.data.enabled as boolean)
      }
    }
    ch.addEventListener("message", handler)
    return () => {
      ch.removeEventListener("message", handler)
      ch.close()
    }
  }, [])

  const toggle = useCallback(
    (next: boolean) => {
      if (isGuest) {
        alert("Sign in to enable live mode.")
        return
      }
      setEnabled(next)
      try {
        sessionStorage.setItem(STORAGE_KEY, next ? "1" : "0")
      } catch {}
      if (typeof BroadcastChannel !== "undefined") {
        const ch = new BroadcastChannel(LIVE_CHANNEL)
        ch.postMessage({ type: "live_mode_changed", enabled: next })
        ch.close()
      }
    },
    [isGuest],
  )

  return [enabled, toggle]
}

/**
 * Broadcast a completed execution row to all open pages immediately,
 * so they can update their views without waiting for the 3-second SSE poll.
 */
export function broadcastExecution(row: ExecutionRow): void {
  try {
    if (typeof BroadcastChannel === "undefined") return
    const ch = new BroadcastChannel(LIVE_CHANNEL)
    ch.postMessage({ type: "execution_completed", row })
    ch.close()
  } catch {
    // Non-critical — SSE will pick it up within 3 s anyway
  }
}
