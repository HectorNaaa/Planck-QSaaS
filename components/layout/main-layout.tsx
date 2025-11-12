"use client"

import type { ReactNode } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { Sidebar } from "./sidebar"
import { MobileBottomNav } from "./mobile-bottom-nav"
import Image from "next/image"

export function MainLayout({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile()

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      {!isMobile && <Sidebar />}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="absolute top-4 right-4 z-10">
          <Image
            src="/logo-isotipo.png"
            alt="Planck Isotipo"
            width={40}
            height={40}
            className="opacity-30 hover:opacity-50 transition-opacity"
          />
        </div>
        <div className="flex-1 overflow-auto">{children}</div>
      </main>

      {/* Mobile Bottom Navigation */}
      {isMobile && <MobileBottomNav />}
    </div>
  )
}
