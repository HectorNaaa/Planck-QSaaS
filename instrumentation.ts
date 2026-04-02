/**
 * Next.js Instrumentation — runs once on server startup.
 *
 * Prints boolean indicators for critical env vars so operators can
 * immediately tell if something is missing without exposing secrets.
 */
export function register() {
  const vars = [
    "JWT_SECRET",
    "OPENAI_API_KEY",
    "NEXT_PUBLIC_APP_URL",
    "DB_DIR",
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
