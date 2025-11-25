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
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const hasSession = hasActiveSession()

    // If no session and not on auth page, redirect immediately
    if (!hasSession && !pathname.startsWith("/auth/")) {
      router.push("/auth/login")
      return
    }

    setIsCheckingAuth(false)

    // Show loading screen for exactly 7 seconds
    const loadingDuration = 7000
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, loadingDuration)

    return () => clearTimeout(timer)
  }, [router, pathname])

  if (isCheckingAuth) {
    return null
  }

  if (isLoading) {
    return <QuantumLoadingScreen />
  }

  return <MainLayout>{children}</MainLayout>
}
