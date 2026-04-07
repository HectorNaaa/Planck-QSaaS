"use server"

import { cookies } from "next/headers"
import { Users, Profiles, ApiKeys } from "@/lib/db/client"
import { verifyJWT, generateJWT, generateApiKey as genApiKey } from "@/lib/auth-utils"

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
    const key = genApiKey()
    ApiKeys.create(payload.userId, "Default Key", key)
    return { success: true, apiKey: key }
  } catch (error: any) {
    console.error("Generate API key error:", error)
    return { error: error.message || "Failed to generate API key" }
  }
}

export async function getApiKey() {
  const payload = await getJWTPayload()
  if (!payload) {
    return { error: "Not authenticated" }
  }

  try {
    const keys = ApiKeys.findByUserId(payload.userId)
    return { success: true, keys }
  } catch (error: any) {
    console.error("Get API key error:", error)
    return { error: error.message || "Failed to get API keys" }
  }
}

export async function revokeApiKey() {
  const payload = await getJWTPayload()
  if (!payload) {
    return { error: "Not authenticated" }
  }

  try {
    const keys = ApiKeys.findByUserId(payload.userId)
    for (const key of keys) {
      ApiKeys.delete(key.id)
    }
    return { success: true }
  } catch (error: any) {
    console.error("Revoke API key error:", error)
    return { error: error.message || "Failed to revoke API key" }
  }
}


