"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LoadingSpinner } from "@/components/loading-spinner"

interface ProtectedRouteProps {
  children: ReactNode
  requireAuth?: boolean
}

export function ProtectedRoute({ children, requireAuth = false }: ProtectedRouteProps) {
  const [status, setStatus] = useState<"loading" | "ok" | "denied">("loading")
  const router = useRouter()

  useEffect(() => {
    if (!requireAuth) {
      setStatus("ok")
      return
    }

    fetch("/api/request-utils", { credentials: "include" })
      .then((res) => {
        if (res.ok) {
          setStatus("ok")
        } else {
          setStatus("denied")
          router.push("/auth/login")
        }
      })
      .catch(() => {
        setStatus("denied")
        router.push("/auth/login")
      })
  }, [requireAuth, router])

  if (status === "loading" && requireAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (status === "denied") return null

  return <>{children}</>
}
