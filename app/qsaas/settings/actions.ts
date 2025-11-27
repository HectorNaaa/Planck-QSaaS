"use server"

import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

export async function deleteUserAccount() {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "Not authenticated" }
  }

  const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  try {
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
