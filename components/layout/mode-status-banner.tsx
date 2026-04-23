"use client"

/**
 * components/layout/mode-status-banner.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Fixed top banner that shows "Synthetic mode running" and/or "SDK mode running"
 * regardless of which qsaas page the user is on.
 *
 * Rendered once in the QSaaS layout so it is always visible even as the user
 * navigates between Runner, Dashboard, Templates and Settings.
 */

import { useSyntheticMode } from "@/contexts/synthetic-mode-context"
import { useLiveMode } from "@/hooks/use-live-mode"
import { FlaskConical, Radio } from "lucide-react"
import { useIsGuest } from "@/components/guest-banner"

export function ModeStatusBanner() {
  const isGuest = useIsGuest()
  const { isRunning: syntheticRunning, iteration, params } = useSyntheticMode()
  const [sdkMode] = useLiveMode(isGuest)

  if (!syntheticRunning && !sdkMode) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3 px-4 py-1.5 bg-background/95 backdrop-blur border-b border-border shadow-sm pointer-events-none">
      {syntheticRunning && (
        <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#7ab5ac" }}>
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7ab5ac] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#7ab5ac]" />
          </span>
          <FlaskConical size={12} />
          Synthetic mode running
          <span className="opacity-60 font-normal">
            · {params.algorithm} · {params.intervalSecs}s · {iteration} iter{iteration !== 1 ? "s" : ""}
          </span>
        </span>
      )}

      {syntheticRunning && sdkMode && (
        <span className="text-muted-foreground text-xs select-none">|</span>
      )}

      {sdkMode && (
        <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          <Radio size={12} />
          SDK mode running
        </span>
      )}
    </div>
  )
}
