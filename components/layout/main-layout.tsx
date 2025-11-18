"use client"

import type { ReactNode } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { Sidebar } from "./sidebar"
import { MobileBottomNav } from "./mobile-bottom-nav"

export function MainLayout({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile()

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      {!isMobile && <Sidebar />}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden pb-20 md:pb-0">
        <div className="flex-1 overflow-auto p-4 md:p-8 py-0">{children}</div>
      </main>

      {/* Mobile Bottom Navigation */}
      {isMobile && <MobileBottomNav />}
    </div>
  )
}
