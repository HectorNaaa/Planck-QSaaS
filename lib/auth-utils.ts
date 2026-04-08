import crypto from 'crypto'

const JWT_SECRET = process.env.JWT_SECRET || ''

if (!JWT_SECRET) {
  console.error('[AUTH] CRITICAL: JWT_SECRET environment variable is not set. Authentication will not work securely.')
}

// Use a runtime-safe fallback only in development
const EFFECTIVE_SECRET = JWT_SECRET || (process.env.NODE_ENV === 'development' ? 'dev-only-unsafe-secret' : '')

export interface JWTPayload {
  userId: string
  email: string
  fullName?: string
  organization?: string
  themePreference?: string
  phone?: string
  country?: string
  occupation?: string
  stayLoggedIn?: boolean
  /** SHA-256 hash of password — stored in JWT for self-healing after ephemeral DB loss */
  ph?: string
  /** Active API key — stored in JWT so it survives ephemeral DB wipes on Vercel */
  ak?: string
  iat: number
  exp: number
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

function base64UrlDecode(str: string): string {
  str += '='.repeat(4 - (str.length % 4))
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
}

export function generateJWT(
  userId: string,
  email: string,
  options: {
    fullName?: string
    organization?: string
    themePreference?: string
    phone?: string
    country?: string
    occupation?: string
    stayLoggedIn?: boolean
    passwordHash?: string
    apiKey?: string
    expiresIn?: number
  } = {}
): string {
  const {
    fullName, organization, themePreference,
    phone, country, occupation, stayLoggedIn, passwordHash, apiKey,
    expiresIn = 7 * 24 * 60 * 60 * 1000,
  } = options
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  }

  const now = Math.floor(Date.now() / 1000)
  const payload: JWTPayload = {
    userId,
    email,
    iat: now,
    exp: now + Math.floor(expiresIn / 1000),
    ...(fullName !== undefined && { fullName }),
    ...(organization !== undefined && { organization }),
    ...(themePreference !== undefined && { themePreference }),
    ...(phone !== undefined && { phone }),
    ...(country !== undefined && { country }),
    ...(occupation !== undefined && { occupation }),
    ...(stayLoggedIn !== undefined && { stayLoggedIn }),
    ...(passwordHash !== undefined && { ph: passwordHash }),
    ...(apiKey !== undefined && { ak: apiKey }),
  }

  const headerEncoded = base64UrlEncode(JSON.stringify(header))
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload))

  const signature = crypto
    .createHmac('sha256', EFFECTIVE_SECRET)
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest('base64url')

  return `${headerEncoded}.${payloadEncoded}.${signature}`
}

export function verifyJWT(token: string): JWTPayload | null {
  try {
    const [headerEncoded, payloadEncoded, signatureEncoded] = token.split('.')

    // Verify signature
    const signature = crypto
      .createHmac('sha256', EFFECTIVE_SECRET)
      .update(`${headerEncoded}.${payloadEncoded}`)
      .digest('base64url')

    if (signature !== signatureEncoded) {
      return null
    }

    // Decode and parse payload
    const payload = JSON.parse(base64UrlDecode(payloadEncoded)) as JWTPayload

    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

export function hashPassword(password: string): string {
  return crypto
    .createHash('sha256')
    .update(password + EFFECTIVE_SECRET)
    .digest('hex')
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash
}

export function generateRandomId(): string {
  return crypto.randomBytes(16).toString('hex')
}

export function generateApiKey(): string {
  return `pk_${crypto.randomBytes(32).toString('hex')}`
}
