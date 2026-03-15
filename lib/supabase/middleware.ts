import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) return supabaseResponse

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          // Must mutate request cookies AND create a fresh response that carries them forward
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })

    // IMPORTANT: getUser() is the correct call — do NOT use getSession() here as
    // it reads the JWT from cookies without validating it server-side.
    const { data: { user } } = await supabase.auth.getUser()

    const path = request.nextUrl.pathname

    // Redirect unauthenticated users away from protected routes
    if (path.startsWith("/qsaas") && !user) {
      const url = request.nextUrl.clone()
      url.pathname = "/auth/login"
      url.searchParams.set("redirect", path)
      return NextResponse.redirect(url)
    }

    // Redirect authenticated users away from auth pages
    if (user && (path === "/auth/login" || path === "/auth/sign-up")) {
      const url = request.nextUrl.clone()
      url.pathname = "/qsaas/dashboard"
      return NextResponse.redirect(url)
    }

    // IMPORTANT: must return supabaseResponse (not NextResponse.next()) so the
    // refreshed session cookies are forwarded to the browser.
    return supabaseResponse
  } catch {
    return supabaseResponse
  }
}
