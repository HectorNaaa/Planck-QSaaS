import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/signup
 * 
 * Simple signup endpoint that creates a new user and profile.
 * 
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "password": "password123",
 *   "firstName": "John",
 *   "lastName": "Doe",
 *   "country": "United States",
 *   "phone": "+1234567890",
 *   "occupation": "student"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "user": { id, email, ... },
 *   "message": "..."
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      country,
      phone,
      occupation,
      organization,
    } = await request.json()

    // Validation
    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Email, password, first name, and last name are required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const trimmedEmail = email.toLowerCase().trim()

    // Check if email already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', trimmedEmail)
      .single()

    if (existingProfile) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      )
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          country,
          phone_number: phone,
          occupation,
          organization,
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
      },
    })

    if (authError) {
      console.error('Auth signup error:', authError)
      return NextResponse.json(
        { error: authError.message || 'Signup failed' },
        { status: 400 }
      )
    }

    if (!authData?.user) {
      return NextResponse.json(
        { error: 'User creation failed' },
        { status: 500 }
      )
    }

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: trimmedEmail,
        first_name: firstName,
        last_name: lastName,
        country,
        phone_number: phone,
        occupation,
        organization,
        email_verified: !authData.user.email_confirmed_at ? false : true,
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      return NextResponse.json(
        { error: 'Failed to create user profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name: `${firstName} ${lastName}`,
      },
      message: authData.user.email_confirmed_at
        ? 'Signup successful'
        : 'Signup successful. Please check your email to verify your account.',
    })

  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Signup failed. Please try again.' },
      { status: 500 }
    )
  }
}
