"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { useIsGuest } from "@/components/guest-banner"

export interface UIPreferencesContextType {
  hidden: Set<string>
  isHidden: (key: string) => boolean
  toggle: (key: string) => void
  loading: boolean
}

const UIPreferencesContext = createContext<UIPreferencesContextType>({
  hidden: new Set(),
  isHidden: () => false,
  toggle: () => {},
  loading: false,
})

export function UIPreferencesProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const isGuest = useIsGuest()

  useEffect(() => {
    if (isGuest) {
      setLoading(false)
      return
    }
    fetch("/api/user/preferences", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { hidden: [] }))
      .then((d) => setHidden(new Set(Array.isArray(d?.hidden) ? d.hidden : [])))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isGuest])

  const toggle = useCallback((key: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      // Fire-and-forget persist
      fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ hidden: [...next] }),
      }).catch(() => {})
      return next
    })
  }, [])

  const isHidden = useCallback((key: string) => hidden.has(key), [hidden])

  return (
    <UIPreferencesContext.Provider value={{ hidden, isHidden, toggle, loading }}>
      {children}
    </UIPreferencesContext.Provider>
  )
}

export const useUIPreferences = () => useContext(UIPreferencesContext)
