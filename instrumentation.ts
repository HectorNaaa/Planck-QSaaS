/**
 * Next.js Instrumentation — runs once on server startup.
 *
 * Prints boolean indicators for critical env vars so operators can
 * immediately tell if something is missing without exposing secrets.
 */
export function register() {
  const vars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_JWT_SECRET",
  ] as const

  console.log("--- [Planck] Environment Check ---")
  for (const v of vars) {
    const present = !!process.env[v]
    if (!present) {
      console.warn(`  ${v}: MISSING`)
    } else {
      console.log(`  ${v}: set`)
    }
  }
  console.log("--- [Planck] End Environment Check ---")
}
