import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/login
 * 
 * Simple login endpoint that authenticates user and verifies they exist.
 * 
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "password": "password123"
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
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Attempt to sign in
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    })

    if (authError) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { error: authError.message || 'Invalid credentials' },
        { status: 401 }
      )
    }

    if (!authData?.user || !authData?.session) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    }

    // Verify user exists in profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .eq('id', authData.user.id)
      .single()

    if (profileError || !profile) {
      console.error('Profile lookup error:', profileError)
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Create response with session data
    const response = NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name: profile?.first_name ? `${profile.first_name} ${profile.last_name}` : authData.user.email,
      },
      message: 'Login successful'
    })

    // Set session cookie (Supabase handles this, but we ensure it's set)
    if (authData.session?.access_token) {
      response.cookies.set({
        name: 'sb-token',
        value: authData.session.access_token,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      })
    }

    return response

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Login failed. Please try again.' },
      { status: 500 }
    )
  }
}
