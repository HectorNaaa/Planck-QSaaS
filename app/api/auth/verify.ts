import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/verify
 * 
 * Verifies if a user exists in the database based on their email.
 * This is a simple endpoint to check user existence before login/signup.
 * 
 * Request body:
 * {
 *   "email": "user@example.com"
 * }
 * 
 * Response:
 * {
 *   "exists": true/false,
 *   "verified": true/false,
 *   "message": "..."
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Check if user exists in auth.users (via profiles table)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email_confirmed_at')
      .eq('id', (await supabase.auth.getUser())?.data?.user?.id || '')
      .single()

    // For sign-up verification - check if email already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (existingProfile) {
      return NextResponse.json({
        exists: true,
        verified: !!profile?.email_confirmed_at,
        message: 'User already registered'
      })
    }

    return NextResponse.json({
      exists: false,
      verified: false,
      message: 'Email available for registration'
    })

  } catch (error) {
    console.error('Verification error:', error)
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    )
  }
}
