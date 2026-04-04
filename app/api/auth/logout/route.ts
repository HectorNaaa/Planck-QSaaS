import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true })
  
  // Clear auth cookie
  response.cookies.delete('auth-token')
  // Clear guest cookie
  response.cookies.delete('planck_guest')
  
  return response
}
