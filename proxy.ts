import { updateSession } from "@/lib/supabase/middleware"
import type { NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

// Default export for compatibility with both Next.js 16.0.x and 16.1+
export default proxy

export const config = {
  matcher: ["/((?!api/quantum|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
