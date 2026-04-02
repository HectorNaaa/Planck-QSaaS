import { NextRequest, NextResponse } from "next/server"

// Routes that require an authenticated session (auth-token cookie)
const PROTECTED_PREFIXES = ["/qsaas/"]

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only protect /qsaas/* routes
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  if (!isProtected) return NextResponse.next()

  // Allow guests (planck_guest cookie set by the guest login button)
  const isGuest = request.cookies.get("planck_guest")?.value === "true"
  if (isGuest) return NextResponse.next()

  // Require auth-token cookie for all other /qsaas/* requests
  const hasToken = !!request.cookies.get("auth-token")?.value
  if (!hasToken) {
    const loginUrl = new URL("/auth/login", request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
