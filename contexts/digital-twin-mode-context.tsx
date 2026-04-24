"use client"

import { createContext, useContext, useState, useEffect } from "react"
import type React from "react"

const LS_KEY = "planck_dt_mode"

interface DigitalTwinModeContextValue {
  dtMode: boolean
  toggleDtMode: () => void
}

const DigitalTwinModeContext = createContext<DigitalTwinModeContextValue>({
  dtMode: true,
  toggleDtMode: () => {},
})

export function DigitalTwinModeProvider({ children }: { children: React.ReactNode }) {
  // Default ON — read from localStorage if available
  const [dtMode, setDtMode] = useState<boolean>(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY)
      if (stored !== null) setDtMode(stored === "true")
    } catch {
      // localStorage unavailable (e.g. SSR) — keep default
    }
  }, [])

  const toggleDtMode = () => {
    setDtMode((prev) => {
      const next = !prev
      try {
        localStorage.setItem(LS_KEY, String(next))
      } catch {}
      return next
    })
  }

  return (
    <DigitalTwinModeContext.Provider value={{ dtMode, toggleDtMode }}>
      {children}
    </DigitalTwinModeContext.Provider>
  )
}

export function useDigitalTwinMode() {
  return useContext(DigitalTwinModeContext)
}
