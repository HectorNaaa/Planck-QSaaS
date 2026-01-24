"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { Sidebar } from "./sidebar"
import { MobileBottomNav } from "./mobile-bottom-nav"
import { QuantumAssistant } from "@/components/quantum-assistant"

export function MainLayout({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile()
  const [userId, setUserId] = useState<string | undefined>()

  useEffect(() => {
    const storedUserId = sessionStorage.getItem("planck_user_id")
    if (storedUserId) {
      setUserId(storedUserId)
    }
  }, [])

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      {!isMobile && <Sidebar />}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-4 md:p-8 pb-20 md:pb-4">{children}</div>
      </main>

      {/* Mobile Bottom Navigation */}
      {isMobile && <MobileBottomNav />}

      {/* AI Assistant */}
      <QuantumAssistant userId={userId} />
    </div>
  )
}
