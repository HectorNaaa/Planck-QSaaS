/**
 * lib/encryption.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Per-user field-level encryption at rest for sensitive execution content
 * (what a client ran and the results they got back).
 *
 * Goal: a person with only raw database/file access (no authenticated
 * session for that specific user) cannot read execution payloads. Each
 * user's data is encrypted with its own derived key (HMAC-SHA256 of a
 * server-side master secret + userId), so compromising/inspecting one
 * user's row never reveals another user's key or plaintext — containment
 * instead of one shared secret protecting (or exposing) everyone at once.
 *
 * This is encryption-at-rest for staff/DB-access isolation, not a substitute
 * for authentication — the application layer still needs the request to be
 * authenticated as that user (or hold the master secret) to decrypt.
 */
import crypto from 'crypto'

const MASTER_SECRET = process.env.DATA_ENCRYPTION_KEY || process.env.JWT_SECRET || ''
const ALGORITHM = 'aes-256-gcm'
const PREFIX = 'enc:v1:'

function deriveUserKey(userId: string): Buffer {
  return crypto.createHmac('sha256', MASTER_SECRET || 'dev-only-unsafe-secret').update(userId).digest()
}

/** Encrypts `plaintext` with a key derived from `userId`. No-op (returns plaintext) if input is empty/undefined. */
export function encryptForUser(userId: string, plaintext: string | null | undefined): string | null {
  if (plaintext === null || plaintext === undefined) return plaintext ?? null
  if (!MASTER_SECRET) return plaintext // fail-open only when no secret is configured at all (dev)
  try {
    const key = deriveUserKey(userId)
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    return `${PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`
  } catch {
    return plaintext // never block a write because encryption failed
  }
}

/** Decrypts a value produced by encryptForUser. Returns the input unchanged if it isn't in our encrypted format (pre-migration rows). */
export function decryptForUser(userId: string, value: string | null | undefined): string | null {
  if (value === null || value === undefined) return value ?? null
  if (!value.startsWith(PREFIX)) return value
  try {
    const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(':')
    const key = deriveUserKey(userId)
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    const plaintext = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()])
    return plaintext.toString('utf8')
  } catch {
    return null // tampered/undecryptable — never leak ciphertext as if it were plaintext
  }
}
