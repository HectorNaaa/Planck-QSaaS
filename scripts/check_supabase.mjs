/**
 * check_supabase.mjs -- Verify Supabase connectivity from the server environment.
 *
 * Usage:
 *   node scripts/check_supabase.mjs
 *
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log("--- Supabase Connectivity Check ---")
console.log("NEXT_PUBLIC_SUPABASE_URL set:", !!url)
console.log("SUPABASE_SERVICE_ROLE_KEY set:", !!key)

if (!url || !key) {
  console.error("ABORT: Missing required env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

try {
  // 1. Simple read from profiles (limit 1, service-role bypasses RLS)
  const { data, error, count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })

  if (error) {
    console.error("QUERY ERROR:", error.message)
    process.exit(1)
  }

  console.log("Connection OK. Profiles table reachable. Row count:", count)

  // 2. Check execution_logs table exists
  const { error: logsError } = await supabase
    .from("execution_logs")
    .select("id", { count: "exact", head: true })

  console.log("execution_logs table:", logsError ? `ERROR: ${logsError.message}` : "OK")

  console.log("--- Done ---")
  process.exit(0)
} catch (err) {
  console.error("UNEXPECTED ERROR:", err)
  process.exit(1)
}
