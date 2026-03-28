import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const REQUEST_TIMEOUT = 15000 // 15 seconds

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), ms)
    ),
  ])
}

export async function POST(request: NextRequest) {
  try {
    let body
    try {
      body = await withTimeout(request.json(), REQUEST_TIMEOUT)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

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

    const supabase = await createClient()
    const trimmedEmail = email.toLowerCase().trim()

    try {
      // Check if email exists
      const { data: existing } = await withTimeout(
        supabase
          .from('profiles')
          .select('id')
          .eq('email', trimmedEmail)
          .single(),
        REQUEST_TIMEOUT
      )

      if (existing) {
        return NextResponse.json(
          { error: 'Email already registered' },
          { status: 409 }
        )
      }

      // Create auth user
      const { data: authData, error: authError } = await withTimeout(
        supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
            },
          },
        }),
        REQUEST_TIMEOUT
      )

      if (authError) {
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
      const { error: profileError } = await withTimeout(
        supabase
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
          }),
        REQUEST_TIMEOUT
      )

      if (profileError) {
        console.error('Profile creation error:', profileError)
        return NextResponse.json(
          { error: 'Failed to create profile' },
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
      })
    } catch (supabaseError) {
      console.error('Supabase error:', supabaseError)
      
      if (supabaseError instanceof Error && supabaseError.message === 'Request timeout') {
        return NextResponse.json(
          { error: 'Service is slow. Please try again.' },
          { status: 504 }
        )
      }
      
      return NextResponse.json(
        { error: 'Service unavailable. Please try again.' },
        { status: 503 }
      )
    }
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
