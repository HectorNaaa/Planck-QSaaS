/**
 * Configures Supabase Auth via Management API:
 * - Enables email/password provider
 * - Disables email confirmation (mailer_autoconfirm=true)
 * - Sets correct site URL
 *
 * Uses SUPABASE_ACCESS_TOKEN if set, otherwise prints manual instructions.
 */

const PROJECT_REF = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/)
  return match ? match[1] : null
})()

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_REF) {
  console.error("Could not determine project ref from NEXT_PUBLIC_SUPABASE_URL")
  process.exit(1)
}

console.log("Project ref:", PROJECT_REF)

async function tryManagementAPI() {
  if (!ACCESS_TOKEN) {
    console.log("No SUPABASE_ACCESS_TOKEN — skipping Management API.")
    return false
  }

  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      external_email_enabled: true,
      mailer_autoconfirm: true,
      enable_signup: true,
      site_url: "https://www.plancktechnologies.xyz",
      additional_redirect_urls: [
        "http://localhost:3000",
        "http://localhost:3000/**",
        "https://www.plancktechnologies.xyz/**",
      ],
      external_phone_enabled: false,
      mailer_secure_email_change_enabled: false,
    }),
  })

  const body = await res.text()
  if (!res.ok) {
    console.error(`Management API error (${res.status}):`, body)
    return false
  }

  console.log("Management API success:", body)
  return true
}

async function verifyAdminAndAutoConfirmUsers() {
  if (!SERVICE_ROLE_KEY) {
    console.log("No SUPABASE_SERVICE_ROLE_KEY — cannot verify users via admin.")
    return
  }

  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )

  // List all users and auto-confirm any that aren't confirmed
  const { data: { users }, error } = await supabase.auth.admin.listUsers()
  if (error) {
    console.error("Admin listUsers error:", error.message)
    return
  }

  console.log(`Total users in auth.users: ${users.length}`)

  let confirmed = 0
  for (const user of users) {
    if (!user.email_confirmed_at) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
        email_confirm: true,
      })
      if (updateError) {
        console.error(`Failed to confirm ${user.email}:`, updateError.message)
      } else {
        console.log(`Auto-confirmed: ${user.email}`)
        confirmed++
      }
    }
  }

  const unconfirmed = users.filter(u => !u.email_confirmed_at).length
  console.log(`Users already confirmed: ${users.length - unconfirmed}`)
  console.log(`Newly confirmed: ${confirmed}`)
}

;(async () => {
  try {
    const managementSuccess = await tryManagementAPI()

    if (managementSuccess) {
      console.log("")
      console.log("Auth settings updated via Management API:")
      console.log("  email_enabled: true")
      console.log("  mailer_autoconfirm: true (no email confirmation required)")
      console.log("  enable_signup: true")
    } else {
      console.log("")
      console.log("Could not update auth settings automatically.")
      console.log("Please do this manually in Supabase Dashboard:")
      console.log(`  https://supabase.com/dashboard/project/${PROJECT_REF}/auth/providers`)
      console.log("  1. Enable 'Email' provider")
      console.log("  2. Turn OFF 'Confirm email'")
      console.log("  3. Save")
    }

    // Always auto-confirm existing users regardless of management API success
    console.log("")
    console.log("Checking for unconfirmed users...")
    await verifyAdminAndAutoConfirmUsers()

  } catch (err) {
    console.error("Script failed:", err.message)
    process.exit(1)
  }
})()
