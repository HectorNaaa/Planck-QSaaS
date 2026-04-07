"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { UserRound, X } from "lucide-react"

function getGuestCookie(): boolean {
  if (typeof document === "undefined") return false
  return document.cookie.split(";").some((c) => c.trim().startsWith("planck_guest=true"))
}

/** Hook — returns true when the current visitor is a guest (no auth session).
 *  Checks both the cookie AND the sessionStorage flag set by QsaasLayout. */
export function useIsGuest(): boolean {
  const [isGuest, setIsGuest] = useState(false)

  useEffect(() => {
    // Primary: check the server-verified flag stored by QsaasLayout
    const serverFlag = sessionStorage.getItem("planck_is_guest")
    if (serverFlag !== null) {
      setIsGuest(serverFlag === "true")
      return
    }
    // Fallback: check the cookie directly
    setIsGuest(getGuestCookie())
  }, [])

  return isGuest
}

/** Banner shown at the top of all /qsaas pages for guest visitors */
export function GuestBanner() {
  const [visible, setVisible] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setVisible(getGuestCookie())
  }, [])

  if (!visible) return null

  return (
    <div className="w-full bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between gap-4 text-sm">
      <span className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
        <UserRound size={15} />
        You are browsing as a guest. Sign in to run circuits and save your work.
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="h-7 border-amber-500/50 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
          onClick={() => router.push("/auth/login")}
        >
          Sign In
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-amber-600 dark:text-amber-400"
          onClick={() => setVisible(false)}
          aria-label="Dismiss"
        >
          <X size={14} />
        </Button>
      </div>
    </div>
  )
}
