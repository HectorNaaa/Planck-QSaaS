import { NextRequest, NextResponse } from 'next/server'
import { Users, Profiles } from '@/lib/db/client'
import { hashPassword, generateJWT } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    let body: any = {}
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('[SIGNUP] JSON parse error:', parseError)
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { email, password, firstName, lastName, country, phone, occupation, organization } = body

    console.log('[SIGNUP] Attempt for email:', email)

    if (!email || !password || !firstName || !lastName) {
      console.warn('[SIGNUP] Missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields: email, password, firstName, lastName' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const trimmedEmail = email.toLowerCase().trim()

    // Check if email exists
    let existing: any
    try {
      existing = Users.findByEmail(trimmedEmail)
    } catch (dbReadErr) {
      console.error('[SIGNUP] DB read error (findByEmail):', dbReadErr)
      return NextResponse.json(
        { error: 'Database unavailable. Please try again.' },
        { status: 500 }
      )
    }

    if (existing) {
      console.warn('[SIGNUP] Email already registered:', trimmedEmail)
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    // Create user
    let user: any
    try {
      const passwordHash = hashPassword(password)
      user = Users.create(trimmedEmail, passwordHash)
      console.log('[SIGNUP] User created with id:', user?.id)
    } catch (createErr) {
      console.error('[SIGNUP] Failed to create user:', createErr)
      return NextResponse.json(
        { error: 'Failed to create account. Please try again.' },
        { status: 500 }
      )
    }

    if (!user?.id) {
      console.error('[SIGNUP] User creation returned no id')
      return NextResponse.json(
        { error: 'Account creation failed. Please try again.' },
        { status: 500 }
      )
    }

    // Create profile
    try {
      const fullName = `${firstName} ${lastName}`.trim()
      Profiles.create(user.id, fullName, organization || '')
      console.log('[SIGNUP] Profile created for user:', user.id)
    } catch (profileErr) {
      console.error('[SIGNUP] Failed to create profile (non-fatal):', profileErr)
      // Non-fatal: user record exists, profile can be created later
    }

    // Generate JWT and set cookie
    const fullName = `${firstName} ${lastName}`.trim()
    const token = generateJWT(user.id, user.email)

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: fullName },
    })

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    })

    console.log('[SIGNUP] Success for:', trimmedEmail)
    return response
  } catch (error) {
    console.error('[SIGNUP] Unexpected top-level error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}

