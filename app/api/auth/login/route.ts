import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { Users, Profiles, ApiKeys } from '@/lib/db/client'
import { verifyPassword, generateJWT, verifyJWT, decodeJWTUnchecked } from '@/lib/auth-utils'
import { ensureDbUser } from '@/lib/db/ensure-user'

export async function POST(request: NextRequest) {
  try {
    let body: any = {}
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('[LOGIN] JSON parse error:', parseError)
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    console.log('[LOGIN] Attempt for email:', email)

    // ── Self-heal: if a valid JWT exists (e.g. from another tab), ensure
    // the user row is in SQLite so password verification can succeed even
    // after a Vercel cold start that wiped /tmp.
    try {
      const existingToken = request.cookies.get('auth-token')?.value
      if (existingToken) {
        // Try valid token first, then fall back to expired-but-signed token
        const prev = verifyJWT(existingToken) ?? decodeJWTUnchecked(existingToken)
        if (prev) ensureDbUser(prev)
      }
    } catch { /* best-effort */ }

    // Find user by email
    let user: any
    try {
      user = Users.findByEmail(email.toLowerCase().trim())
    } catch (dbErr) {
      console.error('[LOGIN] DB read error (findByEmail):', dbErr)
      return NextResponse.json(
        { error: 'Authentication service unavailable. Please try again.' },
        { status: 500 }
      )
    }

    // ── Fallback self-heal: no cookie token but DB lost the user (cold start
    // after token expiry).  Decode any stale token to extract the password
    // hash and verify the supplied password against it.
    if (!user) {
      try {
        const staleToken = request.cookies.get('auth-token')?.value
        if (staleToken) {
          const decoded = decodeJWTUnchecked(staleToken)
          if (decoded && decoded.ph && decoded.email === email.toLowerCase().trim()) {
            const { hashPassword } = await import('@/lib/auth-utils')
            const suppliedHash = hashPassword(password)
            if (suppliedHash === decoded.ph) {
              // Password matches → recreate the user so subsequent DB calls work
              console.log('[LOGIN] Self-healing user from expired token for:', email)
              ensureDbUser(decoded)
              user = Users.findByEmail(email.toLowerCase().trim())
            }
          }
        }
      } catch (healErr) {
        console.warn('[LOGIN] Self-heal from expired token failed (non-fatal):', healErr)
      }
    }

    if (!user) {
      console.warn('[LOGIN] No user found for:', email)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Verify password
    const passwordValid = verifyPassword(password, user.password_hash)
    if (!passwordValid) {
      console.warn('[LOGIN] Wrong password for:', email)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Get profile (non-fatal if missing)
    let profile: any = null
    try {
      profile = Profiles.findByUserId(user.id)
    } catch (profileErr) {
      console.warn('[LOGIN] Could not load profile (non-fatal):', profileErr)
    }

    // Generate JWT with ALL profile data
    // Include API key from DB so it survives in the token across cold starts.
    let existingApiKey = ''
    try {
      existingApiKey = ApiKeys.findKeyValueByUserId(user.id) || ''
    } catch { /* non-fatal — key will be re-generated on demand */ }

    // Also carry forward ak from previous JWT if DB had no key (cold start scenario)
    if (!existingApiKey) {
      try {
        const existingToken = request.cookies.get('auth-token')?.value
        if (existingToken) {
          const prev = verifyJWT(existingToken) ?? decodeJWTUnchecked(existingToken)
          if (prev?.ak) existingApiKey = prev.ak
        }
      } catch { /* best-effort */ }
    }

    // ── Multi-device awareness: if the account already has a different active
    // session, warn THIS (new) device rather than silently logging in. We do
    // not block or revoke the other session — JWTs remain independently valid.
    const sessionId = randomUUID()
    const userAgent = (request.headers.get('user-agent') || 'Unknown device').slice(0, 180)
    let otherSessionActive = false
    let otherSessionDevice: string | null = null
    try {
      if (profile?.active_session_id && profile.active_session_id !== sessionId) {
        otherSessionActive = true
        otherSessionDevice = profile.active_session_device || 'another device'
      }
      Profiles.update(user.id, {
        active_session_id: sessionId,
        active_session_started_at: new Date().toISOString(),
        active_session_device: userAgent,
      })
    } catch (sessionErr) {
      console.warn('[LOGIN] Could not record active session (non-fatal):', sessionErr)
    }

    const token = generateJWT(user.id, user.email, {
      fullName: profile?.full_name || '',
      organization: profile?.organization || '',
      themePreference: profile?.theme_preference || 'dark',
      phone: profile?.phone || '',
      country: profile?.country || '',
      occupation: profile?.occupation || '',
      stayLoggedIn: !!profile?.stay_logged_in,
      passwordHash: user.password_hash,
      apiKey: existingApiKey || undefined,
      sessionId,
    })

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        profile: profile || null,
      },
      otherSessionActive,
      otherSessionDevice,
    })

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    })

    // Clear any lingering guest cookie so authenticated mode takes effect immediately.
    response.cookies.delete('planck_guest')

    console.log('[LOGIN] Success for user:', user.id)
    return response
  } catch (error) {
    console.error('[LOGIN] Unexpected top-level error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

