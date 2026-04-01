// Deprecated: Supabase functionality has been replaced with internal SQLite + JWT auth
// This file is kept for compatibility during migration

export async function createClient() {
  throw new Error('createServerClient is no longer available. Use internal auth instead.')
}

export { createClient as createServerClient }
