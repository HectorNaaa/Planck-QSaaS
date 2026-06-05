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
 *  Reads sessionStorage synchronously (via lazy useState initializer) so the
 *  value is correct on the very first render — no false→true flicker that
 *  would cause the dashboard to briefly load authenticated data. */
export function useIsGuest(): boolean {
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    const serverFlag = sessionStorage.getItem("planck_is_guest")
    if (serverFlag !== null) return serverFlag === "true"
    return getGuestCookie()
  })

  useEffect(() => {
    // Keep in sync if the sessionStorage value changes after mount
    // (e.g. layout sets it after an async /api/request-utils call)
    const serverFlag = sessionStorage.getItem("planck_is_guest")
    const value = serverFlag !== null ? serverFlag === "true" : getGuestCookie()
    setIsGuest(value)
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
