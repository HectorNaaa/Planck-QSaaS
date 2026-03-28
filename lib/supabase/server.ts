import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * Returns a Supabase server client bound to the current request's cookie
 * store. Must be called inside a Server Component, Route Handler, or Server
 * Action — never stored in a global variable (Fluid compute compatibility).
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component — safe to ignore; middleware
            // handles the session refresh.
          }
        },
      },
    },
  )
}
