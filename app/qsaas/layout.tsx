import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import type { ReactNode } from "react"

/**
 * Layout for all /qsaas/** routes.
 *
 * Auth priority:
 *  1. Valid Supabase session → full authenticated access.
 *  2. No session + `planck_guest` cookie present → read-only guest mode.
 *  3. Neither → redirect to /auth/login.
 *
 * Guest mode is intentionally read-only and is never a substitute for a real
 * session. The middleware already guards this route, but we double-check here
 * to protect against edge cases where the middleware was bypassed (e.g., RSC
 * direct fetch).
 */
export default async function QSaaSLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Real session — allow through.
  if (user) {
    return <>{children}</>
  }

  // No real session — check for explicit guest cookie.
  const cookieStore = await cookies()
  const guestCookie = cookieStore.get("planck_guest")
  const isGuest = guestCookie?.value === "true"

  if (!isGuest) {
    redirect("/auth/login")
  }

  // Guest access — render the layout with a visual notice.
  return (
    <>
      <div
        role="banner"
        className="flex items-center justify-center gap-2 bg-muted px-4 py-2 text-center text-sm text-muted-foreground"
      >
        {"You are browsing as a guest. "}
        <a href="/auth/sign-up" className="font-medium underline underline-offset-4">
          Sign up
        </a>
        {" for full access."}
      </div>
      {children}
    </>
  )
}
