import { updateSession } from "@/lib/supabase/middleware"
import type { NextRequest } from "next/server"

export default function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    "/((?!api/quantum|api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
