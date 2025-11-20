"use client"

import { useState, useEffect } from "react"
import type React from "react"
import { useRouter, usePathname } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { QuantumLoadingScreen } from "@/components/quantum-loading-screen"
import { hasActiveSession } from "@/lib/auth-session"

export default function QsaasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Always show loading screen for smooth transition
    const randomDuration = Math.floor(Math.random() * 2000) + 5000 // Random between 5000-7000ms

    const timer = setTimeout(() => {
      setIsLoading(false)

      // Check if user has active session after loading
      // Skip auth check if already on auth pages
      if (!pathname.startsWith("/auth/")) {
        const hasSession = hasActiveSession()
        if (!hasSession) {
          // Redirect to login if no active session
          router.push("/auth/login")
        }
      }
    }, randomDuration)

    return () => clearTimeout(timer)
  }, [router, pathname])

  if (isLoading) {
    return <QuantumLoadingScreen />
  }

  return <MainLayout>{children}</MainLayout>
}
