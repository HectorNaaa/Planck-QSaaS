import type { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { getAdminClient } from "@/lib/supabase/admin"
import { validateApiKey } from "@/lib/security"

/**
 * Mask an API key for safe logging (first 6 chars + ... + last 4 chars).
 */
export function maskKey(key: string | null): string {
  if (!key) return "<null>"
  if (key.length < 12) return "***"
  return `${key.slice(0, 6)}...${key.slice(-4)}`
}

export interface AuthResult {
  /** Whether authentication succeeded */
  ok: boolean
  /** Authenticated user ID (profile.id from Supabase) */
  userId: string | null
  /** Which method was used */
  method: "api_key" | "session" | null
  /** HTTP status to return on failure */
  status: number
  /** Error message to return on failure */
  error: string
}

/**
 * Authenticate an incoming API request.
 *
 * Priority:
 *   1. `x-api-key` header  -> look up in `profiles.api_key` via service-role client (bypasses RLS).
 *   2. Supabase session cookie -> standard `supabase.auth.getUser()`.
 *
 * Returns an {@link AuthResult} that the caller can inspect.
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  const apiKey = request.headers.get("x-api-key")

  // ── Path 1: API-key authentication ─────────────────────────────
  if (apiKey) {
    // Format validation
    if (!validateApiKey(apiKey)) {
      console.warn("[Auth] Invalid API key format, masked:", maskKey(apiKey))
      return { ok: false, userId: null, method: "api_key", status: 401, error: "Invalid API key format" }
    }

    try {
      const admin = getAdminClient()
      const { data: profile, error: dbError } = await admin
        .from("profiles")
        .select("id")
        .eq("api_key", apiKey)
        .single()

      if (dbError) {
        console.warn("[Auth] DB lookup failed for key", maskKey(apiKey), "| error:", dbError.message)
      }

      if (dbError || !profile) {
        return { ok: false, userId: null, method: "api_key", status: 401, error: "Invalid API key" }
      }

      console.log("[Auth] API-key authenticated, userId:", profile.id, "key:", maskKey(apiKey))
      return { ok: true, userId: profile.id, method: "api_key", status: 200, error: "" }
    } catch (err: any) {
      console.error("[Auth] Unexpected error during API-key lookup:", err?.message)
      return { ok: false, userId: null, method: "api_key", status: 500, error: "Authentication service error" }
    }
  }

  // ── Path 2: Session-cookie authentication ──────────────────────
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        ok: false,
        userId: null,
        method: "session",
        status: 401,
        error: "Unauthorized. Provide an API key via the x-api-key header or authenticate via session.",
      }
    }

    return { ok: true, userId: user.id, method: "session", status: 200, error: "" }
  } catch (err: any) {
    console.error("[Auth] Session auth error:", err?.message)
    return { ok: false, userId: null, method: "session", status: 500, error: "Authentication service error" }
  }
}
