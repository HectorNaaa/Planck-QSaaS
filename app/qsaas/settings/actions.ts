"use server"

import { cookies } from "next/headers"
import { Users, Profiles, ApiKeys, Executions } from "@/lib/db/client"
import { verifyJWT, generateJWT, generateApiKey as genApiKey } from "@/lib/auth-utils"
import { ensureDbUser } from "@/lib/db/ensure-user"

// ── Auth helper ───────────────────────────────────────────────────────────────
// Identity is derived from the signed JWT — no DB roundtrip required.
async function getJWTPayload() {
  const cookieStore = await cookies()
  const token = cookieStore.get("auth-token")?.value
  if (!token) return null
  return verifyJWT(token) || null
}

// Re-issue the auth-token cookie with updated profile claims.
// Carries forward ALL existing JWT claims so nothing is lost on partial updates.
async function reissueToken(
  payload: import("@/lib/auth-utils").JWTPayload,
  overrides: {
    fullName?: string
    organization?: string
    themePreference?: string
    phone?: string
    country?: string
    occupation?: string
    stayLoggedIn?: boolean
    apiKey?: string
  }
) {
  const token = generateJWT(payload.userId, payload.email, {
    fullName: overrides.fullName ?? payload.fullName,
    organization: overrides.organization ?? payload.organization,
    themePreference: overrides.themePreference ?? payload.themePreference,
    phone: overrides.phone ?? payload.phone,
    country: overrides.country ?? payload.country,
    occupation: overrides.occupation ?? payload.occupation,
    stayLoggedIn: overrides.stayLoggedIn ?? payload.stayLoggedIn,
    passwordHash: payload.ph, // preserve password hash for self-healing
    apiKey: overrides.apiKey !== undefined ? overrides.apiKey : payload.ak, // preserve API key
  })
  const cookieStore = await cookies()
  cookieStore.set("auth-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  })
}

export async function updateUserAccount(data: {
  email?: string
  firstName?: string
  lastName?: string
  country?: string
  phone?: string
  occupation?: string
  org?: string
  theme_preference?: string
  stay_logged_in?: boolean
}) {
  const payload = await getJWTPayload()
  if (!payload) {
    return { error: "Not authenticated" }
  }

  const newFullName =
    data.firstName !== undefined || data.lastName !== undefined
      ? `${data.firstName || ""} ${data.lastName || ""}`.trim()
      : undefined

  const newOrg = data.org !== undefined ? data.org : undefined
  const newTheme = data.theme_preference !== undefined ? data.theme_preference : undefined
  const newPhone = data.phone !== undefined ? data.phone : undefined
  const newCountry = data.country !== undefined ? data.country : undefined
  const newOccupation = data.occupation !== undefined ? data.occupation : undefined
  const newStayLoggedIn = data.stay_logged_in !== undefined ? data.stay_logged_in : undefined

  // Persist to DB if available (local dev). Non-fatal on Vercel where SQLite is ephemeral.
  try {
    // Ensure user row exists before writing profile updates
    ensureDbUser(payload)

    const dbUpdates: Record<string, any> = {}
    if (newFullName !== undefined) dbUpdates.full_name = newFullName
    if (newOrg !== undefined) dbUpdates.organization = newOrg
    if (newTheme !== undefined) dbUpdates.theme_preference = newTheme
    if (newPhone !== undefined) dbUpdates.phone = newPhone
    if (newCountry !== undefined) dbUpdates.country = newCountry
    if (newOccupation !== undefined) dbUpdates.occupation = newOccupation
    if (newStayLoggedIn !== undefined) dbUpdates.stay_logged_in = newStayLoggedIn ? 1 : 0

    if (Object.keys(dbUpdates).length > 0) {
      Profiles.update(payload.userId, dbUpdates)
    }
  } catch (dbErr) {
    console.warn("[SETTINGS] DB profile update failed (non-fatal on serverless):", dbErr)
  }

  // Re-issue JWT so the updated claims are reflected in the current session.
  await reissueToken(payload, {
    fullName: newFullName,
    organization: newOrg,
    themePreference: newTheme,
    phone: newPhone,
    country: newCountry,
    occupation: newOccupation,
    stayLoggedIn: newStayLoggedIn,
  })

  return { success: true, message: "Account updated successfully" }
}

export async function deleteUserAccount() {
  const payload = await getJWTPayload()
  if (!payload) {
    return { error: "Not authenticated" }
  }

  try {
    Users.delete(payload.userId)
  } catch (dbErr) {
    console.warn("[SETTINGS] DB user delete failed (non-fatal):", dbErr)
  }

  const cookieStore = await cookies()
  cookieStore.delete("auth-token")
  cookieStore.delete("planck_guest")

  return { success: true }
}

export async function generateApiKey() {
  const payload = await getJWTPayload()
  if (!payload) {
    return { error: "Not authenticated" }
  }

  try {
    // Ensure user row exists in DB before FK-dependent insert
    ensureDbUser(payload)

    // Revoke existing keys before creating a new one
    const existingKeys = ApiKeys.findByUserId(payload.userId)
    for (const k of existingKeys) {
      ApiKeys.delete(k.id)
    }

    const key = genApiKey()
    ApiKeys.create(payload.userId, "Default Key", key)
    console.log('[SETTINGS] API key generated for user', payload.userId)

    // Embed the key in the JWT so it survives Vercel cold-starts
    await reissueToken(payload, { apiKey: key })

    return { success: true, apiKey: key }
  } catch (error: any) {
    console.error("[SETTINGS] Generate API key error:", error)
    return { error: error.message || "Failed to generate API key" }
  }
}

export async function getApiKey() {
  const payload = await getJWTPayload()
  if (!payload) {
    return { error: "Not authenticated" }
  }

  // The active key is embedded in the JWT (ak claim) for cold-start recovery.
  // Return it so the client can display and copy the real value after page reload.
  const activeKey = payload.ak || null

  try {
    // Ensure user exists so subsequent writes in the same session won't fail
    ensureDbUser(payload)
    const keys = ApiKeys.findByUserId(payload.userId)
    return { success: true, keys, activeKey }
  } catch (error: any) {
    console.error("[SETTINGS] Get API key error:", error)
    // JWT is the canonical source of truth — return it even if DB is unavailable
    return { success: true, keys: [], activeKey }
  }
}

export async function revokeApiKey() {
  const payload = await getJWTPayload()
  if (!payload) {
    return { error: "Not authenticated" }
  }

  try {
    ensureDbUser(payload)
    const keys = ApiKeys.findByUserId(payload.userId)
    for (const key of keys) {
      ApiKeys.delete(key.id)
    }

    // Remove the key from the JWT
    await reissueToken(payload, { apiKey: '' })

    return { success: true }
  } catch (error: any) {
    console.error("[SETTINGS] Revoke API key error:", error)
    return { error: error.message || "Failed to revoke API key" }
  }
}

// ── Execution History Management ──────────────────────────────────────────────

export async function getExecutionStorageStats() {
  const payload = await getJWTPayload()
  if (!payload) return { error: "Not authenticated", usedBytes: 0, totalRows: 0 }
  try {
    ensureDbUser(payload)
    const usedBytes = Executions.getStorageSizeByUserId(payload.userId)
    const rows = Executions.findByUserId(payload.userId)
    return { success: true, usedBytes, totalRows: rows.length }
  } catch (err: any) {
    console.warn("[SETTINGS] getExecutionStorageStats error:", err)
    return { error: err.message || "Failed to get storage stats", usedBytes: 0, totalRows: 0 }
  }
}

export async function getExecutionHistory() {
  const payload = await getJWTPayload()
  if (!payload) return { error: "Not authenticated", history: [] as any[] }
  try {
    ensureDbUser(payload)
    const rows = Executions.findByUserId(payload.userId)
    const history = rows.map((r: any) => ({
      id: r.id,
      circuit_name: r.circuit_name ?? '',
      algorithm: r.algorithm ?? '',
      status: r.status ?? 'pending',
      created_at: new Date(r.created_at ?? Date.now()).toISOString(),
      size_bytes:
        (typeof r.circuit_data === 'string' ? r.circuit_data.length : 0) +
        (typeof r.result === 'string' ? r.result.length : 0) +
        (typeof r.error === 'string' ? r.error.length : 0) + 250,
    }))
    return { success: true, history }
  } catch (err: any) {
    console.warn("[SETTINGS] getExecutionHistory error:", err)
    return { error: err.message || "Failed to get execution history", history: [] as any[] }
  }
}

export async function deleteExecutions(ids: string[]) {
  const payload = await getJWTPayload()
  if (!payload) return { error: "Not authenticated" }
  if (!ids.length) return { success: true, deleted: 0 }
  try {
    ensureDbUser(payload)
    let deleted = 0
    for (const id of ids) {
      // Verify ownership before deleting to prevent cross-user deletion
      const row = Executions.findById(id)
      if (row && row.user_id === payload.userId) {
        Executions.deleteById(id)
        deleted++
      }
    }
    return { success: true, deleted }
  } catch (err: any) {
    console.error("[SETTINGS] deleteExecutions error:", err)
    return { error: err.message || "Failed to delete executions" }
  }
}

export async function clearAllExecutionHistory() {
  const payload = await getJWTPayload()
  if (!payload) return { error: "Not authenticated" }
  try {
    ensureDbUser(payload)
    Executions.deleteByUserId(payload.userId)
    return { success: true }
  } catch (err: any) {
    console.error("[SETTINGS] clearAllExecutionHistory error:", err)
    return { error: err.message || "Failed to clear execution history" }
  }
}


