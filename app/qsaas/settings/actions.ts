"use server"

import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import crypto from "crypto"
import type { GenerateApiKeyResponse, GetApiKeyResponse, RevokeApiKeyResponse } from "@/lib/types/api-keys"
import { validateApiKeyFormat, debugApiKey } from "@/lib/types/api-keys"

export async function updateUserAccount(data: {
  email?: string
  firstName: string
  lastName: string
  country: string
  phone: string
  occupation: string
  org: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "Not authenticated" }
  }

  try {
    const fullName = `${data.firstName} ${data.lastName}`.trim()
    const changes: string[] = []

    // Update email if changed and provided
    if (data.email && data.email !== user.email) {
      const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )

      const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        email: data.email,
      })

      if (emailError) {
        console.error("Error updating email:", emailError)
        return { error: "Failed to update email: " + emailError.message }
      }

      changes.push(`email changed from ${user.email} to ${data.email}`)
    }

    // Update profile data
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        name: fullName,
        org: data.org,
        country: data.country,
        phone_number: data.phone,
        occupation: data.occupation,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)

    if (profileError) {
      console.error("Error updating profile:", profileError)
      return { error: "Failed to update profile: " + profileError.message }
    }

    changes.push("profile updated")

    return { success: true, message: "Account updated successfully" }
  } catch (error: any) {
    console.error("Update account error:", error)
    return { error: error.message || "Failed to update account" }
  }
}

export async function deleteUserAccount() {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: "Not authenticated" }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  try {
    // Delete execution logs and profile first (FK order)
    await supabaseAdmin.from("execution_logs").delete().eq("user_id", user.id)
    await supabaseAdmin.from("profiles").delete().eq("id", user.id)

    // Delete auth user (requires service role)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
    if (deleteError) return { error: deleteError.message }

    // Expire session cookies server-side
    const cookieStore = await cookies()
    cookieStore.getAll().forEach((cookie) => cookieStore.delete(cookie.name))

    return { success: true }
  } catch (error: any) {
    return { error: error.message || "Failed to delete account" }
  }
}

export async function generateApiKey(): Promise<GenerateApiKeyResponse> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "Not authenticated" }
  }

  try {
    // Generate a secure alphanumeric API key (64 characters)
    // Format: Pure alphanumeric string for better compatibility and simplicity
    const apiKey = crypto.randomBytes(32).toString("hex")

    // Validate the generated key format
    const validation = validateApiKeyFormat(apiKey)
    if (!validation.isValid) {
      console.error("[API Key Generation] Invalid key format:", debugApiKey(apiKey))
      return { error: "Failed to generate valid API key format" }
    }

    console.log("[API Key Generation] New key generated:", debugApiKey(apiKey))

    // Update user profile with new API key
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        api_key: apiKey,
        api_key_created_at: new Date().toISOString(),
      })
      .eq("id", user.id)

    if (updateError) {
      console.error("Error generating API key:", updateError)
      return { error: "Failed to generate API key: " + updateError.message }
    }

    return { success: true, apiKey }
  } catch (error: any) {
    return { error: error.message || "Failed to generate API key" }
  }
}

export async function getApiKey(): Promise<GetApiKeyResponse> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "Not authenticated" }
  }

  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("api_key, api_key_created_at")
      .eq("id", user.id)
      .single()

    if (profileError) {
      console.error("Error fetching API key:", profileError)
      return { error: "Failed to fetch API key" }
    }

    return { 
      success: true, 
      apiKey: profile?.api_key || null,
      createdAt: profile?.api_key_created_at || null
    }
  } catch (error: any) {
    console.error("Get API key error:", error)
    return { error: error.message || "Failed to get API key" }
  }
}

export async function revokeApiKey(): Promise<RevokeApiKeyResponse> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "Not authenticated" }
  }

  try {
    // Remove API key from profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        api_key: null,
        api_key_created_at: null,
      })
      .eq("id", user.id)

    if (updateError) {
      console.error("Error revoking API key:", updateError)
      return { error: "Failed to revoke API key: " + updateError.message }
    }

    return { success: true }
  } catch (error: any) {
    return { error: error.message || "Failed to revoke API key" }
  }
}
