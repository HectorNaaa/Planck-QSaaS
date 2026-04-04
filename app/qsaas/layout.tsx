"use client"

import { useState, useEffect } from "react"
import type React from "react"
import { useRouter, usePathname } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { QuantumLoadingScreen } from "@/components/quantum-loading-screen"
import { GuestBanner } from "@/components/guest-banner"
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
        // Guest bypass — skip all auth checks
        if (hasGuestCookie()) {
          setTimeout(() => setIsLoading(false), 1200)
          return
        }

        // Verify session via server endpoint (reads httpOnly auth-token cookie)
        const response = await fetch("/api/request-utils", {
          method: "GET",
          credentials: "include",
        }).catch(() => null)

        if (!response || !response.ok) {
          router.push("/auth/login")
          return
        }

        try {
          const data = await response.json()
          
          if (data?.user) {
            const user = data.user
            sessionStorage.setItem("planck_user_id", user.id || "")
            sessionStorage.setItem("planck_user_email", user.email || "")
            sessionStorage.setItem("planck_user_name", user.full_name || "")
            sessionStorage.setItem("planck_user_org", user.organization || "")
            
            if (user.theme_preference) {
              setTheme(user.theme_preference)
            }
          }
        } catch (parseError) {
          console.error("Failed to parse user data:", parseError)
        }

        sessionStorage.setItem("planck_nav_source", "qsaas")
        setTimeout(() => setIsLoading(false), 1200)
      } catch (error) {
        console.error("Layout init error:", error)
        router.push("/auth/login")
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
