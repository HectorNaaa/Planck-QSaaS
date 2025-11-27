"use client"

import { useState, useEffect } from "react"
import type React from "react"
import { useRouter, usePathname } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { QuantumLoadingScreen } from "@/components/quantum-loading-screen"
import { createClient } from "@/lib/supabase/client"

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
    const checkAuth = async () => {
      const stayLoggedIn = localStorage.getItem("planck_stay_logged_in") !== "false"

      if (!stayLoggedIn) {
        // User doesn't want to stay logged in, check session each time
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session && !pathname.startsWith("/auth/")) {
          router.push("/auth/login")
          return
        }
      } else {
        // User wants to stay logged in, check for valid session
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user && !pathname.startsWith("/auth/")) {
          router.push("/auth/login")
          return
        }
      }

      setIsCheckingAuth(false)

      // Show loading screen for exactly 7 seconds
      const loadingDuration = 7000
      const timer = setTimeout(() => {
        setIsLoading(false)
      }, loadingDuration)

      return () => clearTimeout(timer)
    }

    checkAuth()
  }, [router, pathname])

  if (isCheckingAuth) {
    return null
  }

  if (isLoading) {
    return <QuantumLoadingScreen />
  }

  return <MainLayout>{children}</MainLayout>
}
