/**
 * find_key.mjs -- Look up an API key in the profiles table.
 *
 * Usage:
 *   TARGET_API_KEY=<key> node scripts/find_key.mjs
 *
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   TARGET_API_KEY
 */

import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const targetKey = process.env.TARGET_API_KEY

function mask(key) {
  if (!key) return "<null>"
  if (key.length < 12) return "***"
  return `${key.slice(0, 6)}...${key.slice(-4)}`
}

console.log("--- Find API Key ---")
console.log("TARGET_API_KEY (masked):", mask(targetKey))

if (!url || !serviceKey) {
  console.error("ABORT: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
  process.exit(1)
}
if (!targetKey) {
  console.error("ABORT: Set TARGET_API_KEY to the key you want to look up.")
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

try {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, api_key_created_at")
    .eq("api_key", targetKey)
    .single()

  if (error) {
    console.log("Lookup result: NOT FOUND or error:", error.message)
    process.exit(1)
  }

  console.log("FOUND profile:")
  console.log("  id:", data.id)
  console.log("  name:", data.name)
  console.log("  email:", data.email)
  console.log("  api_key_created_at:", data.api_key_created_at)
  process.exit(0)
} catch (err) {
  console.error("UNEXPECTED ERROR:", err)
  process.exit(1)
}
