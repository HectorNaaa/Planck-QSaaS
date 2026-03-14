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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })

    // Use getUser() — does not force token refresh on every request
    const { data: { user } } = await supabase.auth.getUser()

    const path = request.nextUrl.pathname
    if (path.startsWith("/qsaas") && !user && !path.startsWith("/auth/")) {
      const url = request.nextUrl.clone()
      url.pathname = "/auth/login"
      return NextResponse.redirect(url)
    }

    if (user && (path.startsWith("/auth/login") || path.startsWith("/auth/sign-up"))) {
      const url = request.nextUrl.clone()
      url.pathname = "/qsaas/dashboard"
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  } catch {
    return supabaseResponse
  }
}
