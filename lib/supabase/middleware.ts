import { NextResponse, type NextRequest } from "next/server"
import { verifyJWT } from "@/lib/auth-utils"

export function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Check for valid JWT token
  const token = request.cookies.get("auth-token")?.value
  const isAuthenticated = token && verifyJWT(token) !== null

  // Allow guest access via short-lived cookie set on "Continue as Guest"
  const isGuest = request.cookies.get("planck_guest")?.value === "true"

  // Protect /qsaas routes - require authentication or guest access
  if (path.startsWith("/qsaas") && !isAuthenticated && !isGuest) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    url.searchParams.set("redirect", path)
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && (path === "/auth/login" || path === "/auth/sign-up")) {
    const url = request.nextUrl.clone()
    url.pathname = "/qsaas/dashboard"
    return NextResponse.redirect(url)
  }

  return NextResponse.next({ request })
}

