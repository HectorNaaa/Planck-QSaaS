import db from './init'
import { randomUUID } from 'node:crypto'
import type { JWTPayload } from '@/lib/auth-utils'

/**
 * Canonical helper: guarantee the `users` + `profiles` rows exist for a
 * verified JWT payload.  Every code-path that writes to FK-dependent tables
 * (api_keys, executions, circuits) MUST call this first.
 *
 * - Idempotent: safe to call on every request.
 * - Uses INSERT OR IGNORE so it cannot conflict with an existing row.
 * - Throws on genuine DB errors so callers can surface them instead of
 *   hitting a cryptic FK failure later.
 *
 * Returns the canonical `userId` from the JWT.
 */
export function ensureDbUser(payload: JWTPayload): string {
  const userId = payload.userId
  if (!userId) {
    throw new Error('[ensureDbUser] JWT payload has no userId')
  }

  // ── 1. users row ──────────────────────────────────────────────
  const existingUser = db
    .prepare('SELECT id FROM users WHERE id = ?')
    .get(userId) as { id: string } | undefined

  if (!existingUser) {
    const ph = payload.ph || ''
    console.log('[ensureDbUser] Recreating users row for', userId)
    db.prepare(
      'INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)'
    ).run(userId, payload.email, ph)
  }

  // ── 2. profiles row ──────────────────────────────────────────
  const existingProfile = db
    .prepare('SELECT id FROM profiles WHERE user_id = ?')
    .get(userId) as { id: string } | undefined

  if (!existingProfile) {
    const id = randomUUID()
    console.log('[ensureDbUser] Recreating profiles row for', userId)
    db.prepare(
      `INSERT OR IGNORE INTO profiles
         (id, user_id, full_name, organization, theme_preference, phone, country, occupation, stay_logged_in)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      userId,
      payload.fullName || '',
      payload.organization || '',
      payload.themePreference || 'dark',
      payload.phone || '',
      payload.country || '',
      payload.occupation || '',
      payload.stayLoggedIn ? 1 : 0,
    )
  }

  // ── 3. api_keys row (from JWT `ak` claim) ────────────────────
  // When the user generates an API key we embed it in the JWT so it
  // survives Vercel cold-starts that wipe /tmp SQLite.
  if (payload.ak) {
    const existingKey = db
      .prepare('SELECT id FROM api_keys WHERE user_id = ? AND key = ?')
      .get(userId, payload.ak) as { id: string } | undefined

    if (!existingKey) {
      const id = randomUUID()
      console.log('[ensureDbUser] Recreating api_keys row for', userId)
      db.prepare(
        'INSERT OR IGNORE INTO api_keys (id, user_id, key, name) VALUES (?, ?, ?, ?)'
      ).run(id, userId, payload.ak, 'Default Key')
    }
  }

  return userId
}
