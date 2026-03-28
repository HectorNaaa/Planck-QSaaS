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

    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    try {
      // Sign in with Supabase Auth
      const { data: authData, error: authError } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: email.toLowerCase().trim(),
          password,
        }),
        REQUEST_TIMEOUT
      )

      if (authError) {
        return NextResponse.json(
          { error: authError.message || 'Invalid credentials' },
          { status: 401 }
        )
      }

      if (!authData?.user) {
        return NextResponse.json(
          { error: 'Authentication failed' },
          { status: 401 }
        )
      }

      // Verify user exists in profiles
      const { data: profile } = await withTimeout(
        supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .eq('id', authData.user.id)
          .single(),
        REQUEST_TIMEOUT
      )

      return NextResponse.json({
        success: true,
        user: {
          id: authData.user.id,
          email: authData.user.email,
          name: profile?.first_name ? `${profile.first_name} ${profile.last_name}` : authData.user.email,
        },
      })
    } catch (supabaseError) {
      console.error('Supabase error:', supabaseError)
      
      if (supabaseError instanceof Error && supabaseError.message === 'Request timeout') {
        return NextResponse.json(
          { error: 'Authentication service is slow. Please try again.' },
          { status: 504 }
        )
      }
      
      return NextResponse.json(
        { error: 'Authentication service unavailable. Please try again.' },
        { status: 503 }
      )
    }
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
