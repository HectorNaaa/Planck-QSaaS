import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Phase 1 — forward to the mutated request so downstream RSCs see the
          // refreshed token immediately in the same request.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          // Phase 2 — re-create the response *after* mutating the request so
          // the new request headers are baked in, then attach cookies with their
          // full options (HttpOnly, SameSite, Secure, Max-Age, Path, etc.).
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: Do not place any code between createServerClient and
  // supabase.auth.getUser(). A simple mistake here could make it very hard to
  // debug users being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect all /qsaas/** routes — redirect unauthenticated users to login.
  // Guest-mode logic lives in the layout, but the server-side guard here
  // prevents raw navigation to protected routes without a valid session.
  const isProtected = request.nextUrl.pathname.startsWith("/qsaas")
  const isAuthRoute = request.nextUrl.pathname.startsWith("/auth")

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  // If a logged-in user hits an auth page, send them to the app.
  if (isAuthRoute && user) {
    const url = request.nextUrl.clone()
    url.pathname = "/qsaas/dashboard"
    return NextResponse.redirect(url)
  }

  // IMPORTANT: return the supabaseResponse object as-is so cookies are
  // propagated correctly to the browser.
  return supabaseResponse
}
