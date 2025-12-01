"use client"

import { useState, useEffect } from "react"
import type React from "react"
import { useRouter, usePathname } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { QuantumLoadingScreen } from "@/components/quantum-loading-screen"
import { createBrowserClient } from "@/lib/supabase/client"

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
      try {
        const supabase = createBrowserClient()

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          console.error("[v0] Session check error:", sessionError)
        }

        if (!session) {
          const stayLoggedIn = localStorage.getItem("planck_stay_logged_in") !== "false"

          if (!stayLoggedIn || !pathname.startsWith("/qsaas")) {
            // User doesn't want to stay logged in or trying to access qsaas without session
            if (pathname.startsWith("/qsaas")) {
              router.push("/auth/login")
              return
            }
          }
        } else {
          const {
            data: { user },
          } = await supabase.auth.getUser()

          if (user) {
            // Store user info for quick access
            sessionStorage.setItem("planck_user_id", user.id)
            sessionStorage.setItem("planck_user_email", user.email || "")
          }
        }

        setIsCheckingAuth(false)

        const navigationSource = sessionStorage.getItem("planck_nav_source") || "landing"

        let loadingDuration = 7000 // Default: 7 seconds from landing/auth → qsaas

        // If returning to qsaas from landing (user already in system)
        if (navigationSource === "qsaas" || sessionStorage.getItem("planck_user_id")) {
          loadingDuration = 3000 // 3 seconds when returning
        }

        sessionStorage.setItem("planck_nav_source", "qsaas")

        const timer = setTimeout(() => {
          setIsLoading(false)
        }, loadingDuration)

        return () => clearTimeout(timer)
      } catch (error) {
        console.error("[v0] Auth check error:", error)
        setIsCheckingAuth(false)
        setTimeout(() => setIsLoading(false), 3000)
      }
    }

    checkAuth()
  }, [router, pathname])

  if (isCheckingAuth) {
    return <QuantumLoadingScreen />
  }

  if (isLoading) {
    return <QuantumLoadingScreen />
  }

  return <MainLayout>{children}</MainLayout>
}
