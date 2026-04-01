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
    // TODO: Implement API key validation with internal DB.
    return { ok: false, userId: null, method: "api_key", status: 501, error: "API key auth not implemented" };
  }
  // Additional session handling logic can be implemented here if needed.
}
