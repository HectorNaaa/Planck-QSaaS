"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { useIsGuest } from "@/components/guest-banner"

export interface UIPreferencesContextType {
  hidden: Set<string>
  isHidden: (key: string) => boolean
  toggle: (key: string) => void
  loading: boolean
}

/** Keys that are hidden by default (user must opt-in to show them) */
const HIDDEN_BY_DEFAULT = new Set([
  "display.quantum_probabilities",
  "display.circuit_internals",
])

const UIPreferencesContext = createContext<UIPreferencesContextType>({
  hidden: HIDDEN_BY_DEFAULT,
  isHidden: (key) => HIDDEN_BY_DEFAULT.has(key),
  toggle: () => {},
  loading: false,
})

export function UIPreferencesProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState<Set<string>>(HIDDEN_BY_DEFAULT)
  const [loading, setLoading] = useState(true)
  const isGuest = useIsGuest()

  useEffect(() => {
    if (isGuest) {
      setLoading(false)
      return
    }
    fetch("/api/user/preferences", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { hidden: [] }))
      .then((d) => {
        const serverHidden: string[] = Array.isArray(d?.hidden) ? d.hidden : []
        // If server has never saved preferences, treat hidden-by-default keys as hidden
        // (don't override with empty array)
        if (serverHidden.length === 0) {
          setHidden(HIDDEN_BY_DEFAULT)
        } else {
          setHidden(new Set(serverHidden))
        }
      })
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
