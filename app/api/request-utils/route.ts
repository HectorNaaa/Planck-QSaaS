import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    // ── Authenticated path: JWT takes strict priority over any guest cookie ──
    const token = request.cookies.get('auth-token')?.value
    if (token) {
      const payload = verifyJWT(token)
      if (payload?.userId) {
        return NextResponse.json({
          user: {
            id: payload.userId,
            email: payload.email,
            full_name: payload.fullName || '',
            organization: payload.organization || '',
            theme_preference: payload.themePreference || 'dark',
          },
          guest: false,
        })
      }
    }

    // ── No valid auth-token — check guest cookie ──────────────────────────────
    const guestCookie = request.cookies.get('planck_guest')?.value
    if (guestCookie === 'true') {
      return NextResponse.json({
        user: {
          id: 'guest',
          email: 'guest@planck',
          full_name: 'Guest',
          organization: '',
          theme_preference: 'dark',
        },
        profile: null,
        guest: true,
      })
    }

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  } catch (error) {
    console.error('[REQUEST-UTILS] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

