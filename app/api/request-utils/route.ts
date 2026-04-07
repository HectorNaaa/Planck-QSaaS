import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/auth-utils'
import { selfHealFromJWT } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  try {
    // ── Authenticated path: JWT takes strict priority over any guest cookie ──
    const token = request.cookies.get('auth-token')?.value
    if (token) {
      const payload = verifyJWT(token)
      if (payload?.userId) {
        // Self-heal: ensure user/profile rows exist in SQLite (survives cold starts)
        try { selfHealFromJWT(payload) } catch { /* best-effort */ }

        // Split fullName into first/last for the settings form
        const parts = (payload.fullName || '').split(' ')
        const firstName = parts[0] || ''
        const lastName = parts.slice(1).join(' ') || ''

        return NextResponse.json({
          user: {
            id: payload.userId,
            email: payload.email,
            full_name: payload.fullName || '',
            first_name: firstName,
            last_name: lastName,
            organization: payload.organization || '',
            theme_preference: payload.themePreference || 'dark',
            phone: payload.phone || '',
            country: payload.country || '',
            occupation: payload.occupation || '',
            stay_logged_in: payload.stayLoggedIn ?? true,
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
          first_name: 'Guest',
          last_name: '',
          organization: '',
          theme_preference: 'dark',
          phone: '',
          country: '',
          occupation: '',
          stay_logged_in: false,
        },
        guest: true,
      })
    }

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  } catch (error) {
    console.error('[REQUEST-UTILS] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

