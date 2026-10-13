"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"

/** One-time notice shown on a NEW device/tab when the account already has an
 *  active session elsewhere — asks the user to close the other tab/device
 *  instead of silently running two sessions at once. Read once from
 *  sessionStorage (set by the login page) and then cleared. */
export function OtherSessionBanner() {
  const [device, setDevice] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("planck_other_session_notice")
      if (raw) {
        const parsed = JSON.parse(raw)
        setDevice(parsed.device || "another device")
        sessionStorage.removeItem("planck_other_session_notice")
      }
    } catch { /* non-fatal */ }
  }, [])

  if (!device) return null

  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-primary/30 bg-primary/5 text-sm">
      <div className="flex-1">
        <p className="font-semibold text-primary">Your account is already open on another device</p>
        <p className="text-muted-foreground text-xs mt-0.5">
          Detected: <span className="font-medium text-foreground">{device}</span>. For your account's security, please close that tab or sign out there if it isn't you.
        </p>
      </div>
      <button onClick={() => setDevice(null)} className="text-muted-foreground hover:text-foreground">
        <X size={16} />
      </button>
    </div>
  )
}
