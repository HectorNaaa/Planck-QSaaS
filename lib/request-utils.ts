import { NextRequest } from 'next/server'
import { verifyJWT } from '@/lib/auth-utils'
import { Users } from '@/lib/db/client'

export async function getUserFromRequest(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) return null

    const payload = verifyJWT(token)
    if (!payload) return null

    const user = Users.findById(payload.userId)
    return user || null
  } catch {
    return null
  }
}
