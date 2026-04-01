// Deprecated: Supabase functionality has been replaced with internal SQLite + JWT auth

export function getAdminClient() {
  throw new Error('Supabase admin client is no longer available. Use internal DB client instead.')
}

