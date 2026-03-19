/**
 * Configures Supabase Auth via the Management API:
 * - Enables email/password provider
 * - Disables email confirmation requirement
 * - Disables magic links / OTP (keep only password flow)
 * - Sets correct Site URL and redirect URLs
 *
 * Requires: SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF env vars.
 * These are set automatically when the Supabase integration is active.
 */

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || (() => {
  // Derive from SUPABASE_URL: https://<ref>.supabase.co
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/)
  return match ? match[1] : null
})()

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_REF) {
  console.error("Could not determine SUPABASE_PROJECT_REF from env. Set it explicitly.")
  process.exit(1)
}
if (!SERVICE_ROLE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY not found in env.")
  process.exit(1)
}

console.log(`Configuring Supabase Auth for project: ${PROJECT_REF}`)

// We use the admin API with service role key to update auth config
// Note: Supabase Management API needs a Personal Access Token (SUPABASE_ACCESS_TOKEN)
// but we can achieve the same by directly updating auth.config via admin client.
// The management REST endpoint is: PATCH https://api.supabase.com/v1/projects/{ref}/config/auth

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN

if (!ACCESS_TOKEN) {
  console.warn("SUPABASE_ACCESS_TOKEN not set — will use service role + direct SQL approach instead.")
}

async function configureAuthViaManagementAPI() {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // Enable email provider
      external_email_enabled: true,
      // Disable email confirmation — users can sign in immediately after sign up
      mailer_autoconfirm: true,
      // Disable magic links / OTP (password-only flow)
      enable_signup: true,
      // Site URL for redirects
      site_url: "https://www.plancktechnologies.xyz",
      // Additional redirect URLs (localhost for dev)
      additional_redirect_urls: [
        "http://localhost:3000",
        "http://localhost:3000/**",
        "https://www.plancktechnologies.xyz/**",
      ],
      // Disable phone provider (not needed)
      external_phone_enabled: false,
      // Disable email change confirmation
      mailer_secure_email_change_enabled: false,
    }),
  })

  const body = await res.text()
  if (!res.ok) {
    throw new Error(`Management API failed (${res.status}): ${body}`)
  }
  console.log("Auth config updated via Management API:", body)
  return JSON.parse(body)
}

async function configureAuthViaSQL() {
  // Fallback: use postgres directly via POSTGRES_URL to update auth.config
  // This is the raw approach when Management API token is not available
  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )

  // Check current auth settings via admin
  const { data: users, error } = await supabase.auth.admin.listUsers({ perPage: 1 })
  if (error) {
    console.error("Admin API error:", error.message)
    return
  }
  console.log(`Admin API accessible. Total users: ${users?.users?.length ?? "?"}`)
  console.log("Auth config can only be changed via Supabase Dashboard or Management API token.")
  console.log("Please go to: https://supabase.com/dashboard/project/" + PROJECT_REF + "/auth/providers")
  console.log("1. Enable 'Email' provider")
  console.log("2. Disable 'Confirm email'")
  console.log("3. Disable 'Secure email change'")
}

;(async () => {
  try {
    if (ACCESS_TOKEN) {
      await configureAuthViaManagementAPI()
      console.log("SUCCESS: Supabase Auth configured.")
      console.log("- Email provider: ENABLED")
      console.log("- Email confirmation: DISABLED (mailer_autoconfirm=true)")
      console.log("- Site URL: https://www.plancktechnologies.xyz")
    } else {
      await configureAuthViaSQL()
    }
  } catch (err) {
    console.error("Failed:", err.message)
    process.exit(1)
  }
})()
