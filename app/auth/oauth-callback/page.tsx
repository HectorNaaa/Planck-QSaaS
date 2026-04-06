"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { LoadingSpinner } from "@/components/loading-spinner"

export const dynamic = 'force-dynamic'

export default function OAuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to login — OAuth is handled via internal auth.
    router.push("/auth/login")
  }, [router])

  return (
    <div className="w-full h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <LoadingSpinner />
        <p className="mt-4 text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  )
}
