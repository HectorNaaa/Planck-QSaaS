/**
 * seed_key.mjs -- Upsert a test API key into the profiles table.
 *
 * This is a development helper. Do NOT commit real API keys.
 *
 * Usage:
 *   SEED_USER_ID=<uuid> SEED_API_KEY=<64-hex-chars> node scripts/seed_key.mjs
 *
 * If SEED_API_KEY is not provided, one is generated automatically.
 *
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SEED_USER_ID           -- The profile row (auth.users.id) to update.
 *   SEED_API_KEY           -- Optional. 64-char hex string.
 */

import crypto from "node:crypto"
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const userId = process.env.SEED_USER_ID
const apiKey = process.env.SEED_API_KEY || crypto.randomBytes(32).toString("hex")

function mask(key) {
  if (!key) return "<null>"
  if (key.length < 12) return "***"
  return `${key.slice(0, 6)}...${key.slice(-4)}`
}

console.log("--- Seed API Key ---")
console.log("SEED_USER_ID:", userId || "<not set>")
console.log("API Key (masked):", mask(apiKey))
console.log("API Key length:", apiKey.length)

if (!url || !serviceKey) {
  console.error("ABORT: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
  process.exit(1)
}
if (!userId) {
  console.error("ABORT: Set SEED_USER_ID to the profile UUID you want to update.")
  process.exit(1)
}
if (!/^[a-fA-F0-9]{64}$/.test(apiKey)) {
  console.error("ABORT: API key must be a 64-character hex string. Got length:", apiKey.length)
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

try {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      api_key: apiKey,
      api_key_created_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("id, name, email")
    .single()

  if (error) {
    console.error("UPDATE ERROR:", error.message)
    process.exit(1)
  }

  if (!data) {
    console.error("No profile found with id:", userId)
    process.exit(1)
  }

  console.log("SUCCESS -- API key set for profile:")
  console.log("  id:", data.id)
  console.log("  name:", data.name)
  console.log("  email:", data.email)
  console.log("  key (masked):", mask(apiKey))
  console.log("")
  console.log("Full key (copy now, not logged again):", apiKey)
  process.exit(0)
} catch (err) {
  console.error("UNEXPECTED ERROR:", err)
  process.exit(1)
}
