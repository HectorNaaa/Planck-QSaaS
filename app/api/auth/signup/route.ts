import { NextRequest, NextResponse } from 'next/server'
import { Users, Profiles, ApiKeys } from '@/lib/db/client'
import { hashPassword, generateJWT, generateApiKey } from '@/lib/auth-utils'

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
      // Persist extra profile fields
      const extraFields: Record<string, any> = {}
      if (country) extraFields.country = country
      if (phone) extraFields.phone = phone
      if (occupation) extraFields.occupation = occupation
      if (Object.keys(extraFields).length > 0) {
        Profiles.update(user.id, extraFields)
      }
      console.log('[SIGNUP] Profile created for user:', user.id)
    } catch (profileErr) {
      console.error('[SIGNUP] Failed to create profile (non-fatal):', profileErr)
      // Non-fatal: user record exists, profile can be created later
    }

    // Generate JWT with ALL profile data and set cookie
    const fullName = `${firstName} ${lastName}`.trim()
    const passwordHash = hashPassword(password)

    // Auto-generate an API key so the SDK works immediately after signup
    // without needing to visit Settings first.
    let autoApiKey: string | undefined
    try {
      autoApiKey = generateApiKey()
      ApiKeys.create(user.id, 'Default Key', autoApiKey)
      console.log('[SIGNUP] API key auto-generated for user:', user.id)
    } catch (keyErr) {
      console.warn('[SIGNUP] Failed to auto-create API key (non-fatal):', keyErr)
      autoApiKey = undefined
    }

    const token = generateJWT(user.id, user.email, {
      fullName,
      organization: organization || '',
      phone: phone || '',
      country: country || '',
      occupation: occupation || '',
      passwordHash,
      apiKey: autoApiKey,
    })

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

    // Ensure any lingering guest cookie is cleared so the app does not fall
    // back to guest mode immediately after a successful signup.
    response.cookies.delete('planck_guest')

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

