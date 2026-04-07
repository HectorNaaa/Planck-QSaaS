import type { NextRequest } from "next/server"
import { validateApiKey } from "@/lib/security"
import { verifyJWT } from "@/lib/auth-utils"
import { ApiKeys, selfHealFromJWT } from "@/lib/db/client"

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
  /** Authenticated user ID (profile.id from internal DB) */
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
 *   2. Internal session cookie -> standard JWT auth.
 *
 * Returns an {@link AuthResult} that the caller can inspect.
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  const apiKey = request.headers.get("x-api-key")

  // ── Path 1: API-key authentication ─────────────────────────────
  if (apiKey) {
    if (!validateApiKey(apiKey)) {
      return { ok: false, userId: null, method: "api_key", status: 401, error: "Invalid API key format" }
    }

    try {
      const key = ApiKeys.findByKey(apiKey)
      if (!key?.user_id) {
        return { ok: false, userId: null, method: "api_key", status: 401, error: "Invalid API key" }
      }

      ApiKeys.updateLastUsed(apiKey)
      return { ok: true, userId: key.user_id, method: "api_key", status: 200, error: "" }
    } catch {
      return { ok: false, userId: null, method: "api_key", status: 500, error: "Authentication service error" }
    }
  }

  const token = request.cookies.get("auth-token")?.value
  if (!token) {
    return { ok: false, userId: null, method: "session", status: 401, error: "Unauthorized" }
  }

  const payload = verifyJWT(token)
  if (!payload?.userId) {
    return { ok: false, userId: null, method: "session", status: 401, error: "Invalid session" }
  }

  // Self-heal: ensure user row exists in SQLite (survives cold starts)
  try { selfHealFromJWT(payload) } catch { /* best-effort */ }

  // JWT is the source of truth — no DB roundtrip needed.
  // DB may be empty on serverless/Vercel; the signed token already proves identity.
  return { ok: true, userId: payload.userId, method: "session", status: 200, error: "" }
}
