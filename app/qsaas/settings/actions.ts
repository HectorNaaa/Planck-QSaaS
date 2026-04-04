"use server"

import { cookies } from "next/headers"
import { Users, Profiles, ApiKeys } from "@/lib/db/client"
import { verifyJWT, generateApiKey as genApiKey } from "@/lib/auth-utils"

// Get user from auth token
async function getAuthenticatedUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get("auth-token")?.value
  if (!token) return null
  
  const payload = verifyJWT(token)
  if (!payload) return null
  
  return Users.findById(payload.userId) || null
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
  const user = await getAuthenticatedUser()
  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    const updates: Record<string, any> = {}

    if (data.firstName !== undefined || data.lastName !== undefined) {
      updates.full_name = `${data.firstName || ''} ${data.lastName || ''}`.trim()
    }
    if (data.org !== undefined) updates.organization = data.org
    if (data.phone !== undefined) updates.phone = data.phone
    if (data.theme_preference !== undefined) updates.theme_preference = data.theme_preference
    if (data.stay_logged_in !== undefined) updates.stay_logged_in = data.stay_logged_in ? 1 : 0

    if (Object.keys(updates).length > 0) {
      Profiles.update(user.id, updates)
    }

    return { success: true, message: "Account updated successfully" }
  } catch (error: any) {
    console.error("Update account error:", error)
    return { error: error.message || "Failed to update account" }
  }
}

export async function deleteUserAccount() {
  const user = await getAuthenticatedUser()
  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    // Delete user and cascade delete profile via FK
    Users.delete(user.id)

    // Clear cookies
    const cookieStore = await cookies()
    cookieStore.delete("auth-token")

    return { success: true }
  } catch (error: any) {
    console.error("Delete account error:", error)
    return { error: error.message || "Failed to delete account" }
  }
}

export async function generateApiKey() {
  const user = await getAuthenticatedUser()
  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    const key = genApiKey()
    const apiKey = ApiKeys.create(user.id, "Default Key", key)
    return { success: true, apiKey: key }
  } catch (error: any) {
    console.error("Generate API key error:", error)
    return { error: error.message || "Failed to generate API key" }
  }
}

export async function getApiKey() {
  const user = await getAuthenticatedUser()
  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    const keys = ApiKeys.findByUserId(user.id)
    return { success: true, keys }
  } catch (error: any) {
    console.error("Get API key error:", error)
    return { error: error.message || "Failed to get API keys" }
  }
}

export async function revokeApiKey() {
  const user = await getAuthenticatedUser()
  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    const keys = ApiKeys.findByUserId(user.id)
    for (const key of keys) {
      ApiKeys.delete(key.id)
    }
    return { success: true }
  } catch (error: any) {
    console.error("Revoke API key error:", error)
    return { error: error.message || "Failed to revoke API key" }
  }
}

