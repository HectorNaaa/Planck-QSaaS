"use client"

import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

/**
 * OAuth callback handler.
 * Supabase exchanges the `code` query param for a session and sets the auth
 * cookies. We then redirect the user to the app. Uses `getUser()` (not
 * `getSession()`) so the JWT is always re-validated server-side.
 */
export default function OAuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const handle = async () => {
      const supabase = createClient()
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()

      if (error || !user) {
        router.replace("/auth/login?error=oauth_callback_failed")
        return
      }

      router.replace("/qsaas/dashboard")
    }

    void handle()
  }, [router])

  return (
    <div className="flex min-h-svh items-center justify-center">
      <p className="text-sm text-muted-foreground">Completing sign-in…</p>
    </div>
  )
}
