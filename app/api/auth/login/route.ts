import { NextRequest, NextResponse } from 'next/server'
import { Users, Profiles } from '@/lib/db/client'
import { verifyPassword, generateJWT } from '@/lib/auth-utils'

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

    // Generate JWT
    const token = generateJWT(user.id, user.email)

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

    console.log('[LOGIN] Success for user:', user.id)
    return response
  } catch (error) {
    console.error('[LOGIN] Unexpected top-level error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

