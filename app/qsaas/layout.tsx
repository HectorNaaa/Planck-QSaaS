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
      try {
        const supabase = createBrowserClient()

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          throw sessionError
        }

        if (!session) {
          router.push("/auth/login")
          return
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          router.push("/auth/login")
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()

        if (!profileError && profile) {
          if (profile.theme_preference) {
            setTheme(profile.theme_preference)
          }

          sessionStorage.setItem("planck_user_id", user.id)
          sessionStorage.setItem("planck_user_email", user.email || "")
          sessionStorage.setItem("planck_user_name", profile.name || "")
          sessionStorage.setItem("planck_user_org", profile.org || "")
          sessionStorage.setItem("planck_user_country", profile.country || "")
        }

        const { data: recentLogs } = await supabase
          .from("execution_logs")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10)

        if (recentLogs) {
          sessionStorage.setItem("planck_recent_circuits", JSON.stringify(recentLogs))
        }

        sessionStorage.setItem("planck_nav_source", "qsaas")

        const minLoadingTime = 2000
        const startTime = Date.now()
        const elapsedTime = Date.now() - startTime
        const remainingTime = Math.max(0, minLoadingTime - elapsedTime)

        setTimeout(() => {
          setIsLoading(false)
        }, remainingTime)
      } catch (error) {
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
