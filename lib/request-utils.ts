import { NextRequest } from 'next/server'
import { verifyJWT } from '@/lib/auth-utils'

export async function getUserFromRequest(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) return null

    const payload = verifyJWT(token)
    if (!payload) return null

    // Return user data from JWT claims — no DB roundtrip needed.
    return {
      id: payload.userId,
      email: payload.email,
      full_name: payload.fullName || '',
      organization: payload.organization || '',
      theme_preference: payload.themePreference || 'dark',
    }
  } catch {
    return null
  }
}
