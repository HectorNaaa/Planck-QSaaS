"use server"

import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

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

    // Log the changes to execution_logs for audit trail
    await supabase.from("execution_logs").insert({
      user_id: user.id,
      execution_type: "account_update",
      circuit_name: "Settings Update",
      status: "completed",
      backend: "system",
      qubits_used: 0,
      shots: 0,
      runtime_ms: 0,
      success_rate: 1.0,
      error_mitigation: changes.join(", "),
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })

    return { success: true, message: "Account updated successfully" }
  } catch (error: any) {
    console.error("Update account error:", error)
    return { error: error.message || "Failed to update account" }
  }
}

export async function deleteUserAccount() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "Not authenticated" }
  }

  const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  try {
    // Log deletion before removing data
    await supabaseAdmin.from("execution_logs").insert({
      user_id: user.id,
      execution_type: "account_deletion",
      circuit_name: "Account Deleted",
      status: "completed",
      backend: "system",
      qubits_used: 0,
      shots: 0,
      runtime_ms: 0,
      success_rate: 1.0,
      error_mitigation: `User ${user.email} deleted account`,
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })

    // Delete execution logs
    await supabaseAdmin.from("execution_logs").delete().eq("user_id", user.id)

    // Delete profile
    await supabaseAdmin.from("profiles").delete().eq("id", user.id)

    // Delete auth user (requires service role)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)

    if (deleteError) {
      console.error("Error deleting user:", deleteError)
      return { error: deleteError.message }
    }

    // Clear session cookies
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    allCookies.forEach((cookie) => {
      cookieStore.delete(cookie.name)
    })

    return { success: true }
  } catch (error: any) {
    console.error("Delete account error:", error)
    return { error: error.message || "Failed to delete account" }
  }
}
