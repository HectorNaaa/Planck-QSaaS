/**
 * DELETED — do not use.
 *
 * This file previously implemented a redundant localStorage-based session
 * system with canvas fingerprinting. It conflicted with Supabase Auth and
 * was the root cause of the "guest-only" bug where users could not sign in
 * or sign up via real auth flows.
 *
 * All session state is now managed exclusively by Supabase (@supabase/ssr).
 * - Browser client: lib/supabase/client.ts
 * - Server client:  lib/supabase/server.ts
 * - Session refresh: lib/supabase/middleware.ts (called from middleware.ts)
 *
 * If you see an import of this file in the codebase, remove it.
 */

export {}
