"use client"

import { useState, useEffect } from "react"
import type React from "react"
import { useRouter, usePathname } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { QuantumLoadingScreen } from "@/components/quantum-loading-screen"
import { createBrowserClient } from "@/lib/supabase/client"
import { useTheme } from "next-themes"

export default function QsaasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const { setTheme } = useTheme()

  useEffect(() => {
    const initializeUserSession = async () => {
      console.log("[v0] Starting user session initialization...")

      try {
        const supabase = createBrowserClient()

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          console.error("[v0] Session check error:", sessionError)
          throw sessionError
        }

        if (!session) {
          console.log("[v0] No active session found, redirecting to login...")
          router.push("/auth/login")
          return
        }

        console.log("[v0] Session found, loading user data...")

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          console.error("[v0] Failed to get user:", userError)
          router.push("/auth/login")
          return
        }

        console.log("[v0] User authenticated:", user.email)

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()

        if (profileError) {
          console.error("[v0] Error loading profile:", profileError)
        } else if (profile) {
          console.log("[v0] Profile loaded successfully")

          if (profile.theme_preference) {
            setTheme(profile.theme_preference)
            console.log("[v0] Applied theme:", profile.theme_preference)
          }

          sessionStorage.setItem("planck_user_id", user.id)
          sessionStorage.setItem("planck_user_email", user.email || "")
          sessionStorage.setItem("planck_user_name", profile.name || "")
          sessionStorage.setItem("planck_user_org", profile.org || "")
          sessionStorage.setItem("planck_user_country", profile.country || "")
        }

        const { data: recentLogs, error: logsError } = await supabase
          .from("execution_logs")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10)

        if (logsError) {
          console.error("[v0] Error loading execution logs:", logsError)
        } else {
          console.log(`[v0] Loaded ${recentLogs?.length || 0} recent circuits`)
          if (recentLogs) {
            sessionStorage.setItem("planck_recent_circuits", JSON.stringify(recentLogs))
          }
        }

        sessionStorage.setItem("planck_nav_source", "qsaas")

        console.log("[v0] User session initialized successfully")

        const minLoadingTime = 2000
        const startTime = Date.now()
        const elapsedTime = Date.now() - startTime
        const remainingTime = Math.max(0, minLoadingTime - elapsedTime)

        setTimeout(() => {
          setIsLoading(false)
        }, remainingTime)
      } catch (error) {
        console.error("[v0] Critical error during initialization:", error)
        setTimeout(() => {
          setIsLoading(false)
        }, 2000)
      }
    }

    initializeUserSession()
  }, [router, pathname, setTheme])

  if (isLoading) {
    return <QuantumLoadingScreen />
  }

  return <MainLayout>{children}</MainLayout>
}
