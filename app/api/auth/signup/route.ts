import { NextRequest, NextResponse } from 'next/server'
import { Users, Profiles } from '@/lib/db/client'
import { hashPassword, generateJWT, generateRandomId } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      email,
      password,
      firstName,
      lastName,
      country,
      phone,
      occupation,
      organization,
    } = body

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    const trimmedEmail = email.toLowerCase().trim()

    // Check if email exists
    const existing = Users.findByEmail(trimmedEmail)
    if (existing) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      )
    }

    // Create user
    const passwordHash = hashPassword(password)
    const user = Users.create(trimmedEmail, passwordHash)

    // Create profile
    const fullName = `${firstName} ${lastName}`
    Profiles.create(user.id, fullName, organization)

    // Generate JWT
    const token = generateJWT(user.id, user.email)

    // Set secure cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: fullName,
      },
      token
    })

    // Set auth cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    })

    return response
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
