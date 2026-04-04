import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/auth-utils'
import { Users, Profiles } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyJWT(token)
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const user = Users.findById(payload.userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    let profile = null
    try {
      profile = Profiles.findByUserId(user.id)
    } catch {
      // Non-fatal: profile may not exist yet
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: profile?.full_name || '',
        organization: profile?.organization || '',
        theme_preference: profile?.theme_preference || 'dark',
      },
      profile: profile || null,
    })
  } catch (error) {
    console.error('[REQUEST-UTILS] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
