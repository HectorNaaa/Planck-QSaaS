"use client"

import { useState, useEffect } from "react"
import type React from "react"
import { useRouter, usePathname } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { QuantumLoadingScreen } from "@/components/quantum-loading-screen"
import { GuestBanner } from "@/components/guest-banner"
import { createBrowserClient } from "@/lib/supabase/client"
import { useTheme } from "next-themes"

function hasGuestCookie(): boolean {
  if (typeof document === "undefined") return false
  return document.cookie.split(";").some((c) => c.trim().startsWith("planck_guest=true"))
}

export default function QsaasLayout({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const { setTheme } = useTheme()

  useEffect(() => {
    const init = async () => {
      try {
        // Guest bypass — skip all Supabase calls
        if (hasGuestCookie()) {
          setTimeout(() => setIsLoading(false), 1200)
          return
        }

        const supabase = createBrowserClient()
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError || !session) {
          await supabase.auth.signOut()
          router.push("/auth/login")
          return
        }

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
          await supabase.auth.signOut()
          router.push("/auth/login")
          return
        }

        // Verify the profile row still exists — handles deleted accounts
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()

        if (profileError || !profile) {
          // Profile gone — sign out and redirect
          await supabase.auth.signOut()
          sessionStorage.clear()
          router.push("/auth/login")
          return
        }

        if (profile.theme_preference) setTheme(profile.theme_preference)
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
        setTimeout(() => setIsLoading(false), 2000)
      } catch {
        setTimeout(() => setIsLoading(false), 2000)
      }
    }

    init()
  }, [router, pathname, setTheme])

  if (isLoading) return <QuantumLoadingScreen />

  return (
    <MainLayout>
      <GuestBanner />
      {children}
    </MainLayout>
  )
}
