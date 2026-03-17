import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

let client: SupabaseClient | null = null

export function createBrowserClient() {
  if (client) return client
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!url || !key) {
    console.error("[v0] Supabase env vars missing:", { hasUrl: !!url, hasKey: !!key })
    throw new Error("Supabase configuration missing")
  }
  
  client = createSupabaseBrowserClient(url, key)
  return client
}

// Legacy export for backward compatibility
export function createClient() {
  return createBrowserClient()
}
