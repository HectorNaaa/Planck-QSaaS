// Deprecated: This endpoint is no longer available. Supabase login test has been removed.
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({
    error: 'This endpoint has been removed. Supabase login test is no longer supported.'
  }, { status: 410 })
}
