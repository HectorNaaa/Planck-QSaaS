import { NextRequest, NextResponse } from 'next/server'
import { Users, Profiles, ApiKeys } from '@/lib/db/client'
import { verifyPassword, generateJWT, verifyJWT } from '@/lib/auth-utils'
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
        const prev = verifyJWT(existingToken)
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
          const prev = verifyJWT(existingToken)
          if (prev?.ak) existingApiKey = prev.ak
        }
      } catch { /* best-effort */ }
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
    })

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        profile: profile || null,
      },
    })

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
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

