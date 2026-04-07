import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/auth-utils'
import { selfHealFromJWT } from '@/lib/db/client'

export async function POST(request: NextRequest) {
  // Self-heal before clearing the cookie so the user/profile rows survive
  // in SQLite for subsequent re-login (critical after Vercel cold starts).
  try {
    const token = request.cookies.get('auth-token')?.value
    if (token) {
      const payload = verifyJWT(token)
      if (payload) selfHealFromJWT(payload)
    }
  } catch { /* best-effort */ }

  const response = NextResponse.json({ success: true })
  
  // Clear auth cookie
  response.cookies.delete('auth-token')
  // Clear guest cookie
  response.cookies.delete('planck_guest')
  
  return response
}
