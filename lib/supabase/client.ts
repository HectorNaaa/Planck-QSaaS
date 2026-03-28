import { createBrowserClient } from "@supabase/ssr"

/**
 * Returns a Supabase browser client.
 * Always call this inside a component or event handler — do NOT store the
 * result in a module-level variable (Fluid compute compatibility).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
