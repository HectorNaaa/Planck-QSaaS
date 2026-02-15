import { createClient } from "@supabase/supabase-js"

/**
 * Service-role Supabase client that bypasses RLS.
 *
 * Use ONLY for operations that cannot run under the user's own session,
 * such as looking up a row in `profiles` by `api_key` when the caller
 * has no session cookie (SDK / external HTTP client).
 *
 * NEVER expose this client to the browser.
 */
let _admin: ReturnType<typeof createClient> | null = null

export function getAdminClient() {
  if (_admin) return _admin

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      "[Supabase Admin] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Ensure both are set in the environment."
    )
  }

  _admin = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return _admin
}
