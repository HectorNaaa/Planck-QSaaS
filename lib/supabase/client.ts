// Deprecated: Supabase functionality has been replaced with internal SQLite + JWT auth

export function createBrowserClient() {
  throw new Error('Supabase is no longer supported. Use internal auth via /api/auth/ endpoints.')
}

export function createClient() {
  throw new Error('Supabase is no longer supported. Use internal auth via /api/auth/ endpoints.')
}

