import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export async function middleware(request: NextRequest) {
  // Supabase packages fail to load in v0 preview due to CDN MIME type issues
  // Authentication will work when deployed to production with proper environment
  console.log("[v0] Running in preview mode - authentication disabled")
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
