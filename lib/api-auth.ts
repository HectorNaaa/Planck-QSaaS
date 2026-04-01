import type { NextRequest } from "next/server"
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
    // TODO: Implement API key validation with internal DB.
    return { ok: false, userId: null, method: "api_key", status: 501, error: "API key auth not implemented" }

      if (dbError) {
        console.warn("[Auth] DB lookup failed for key", maskKey(apiKey), "| error:", dbError.message)
  // Session-cookie authentication is removed as well.
        return { ok: false, userId: null, method: "api_key", status: 401, error: "Invalid API key" }

  // Additional session handling logic can be implemented here if needed.
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
