// Deprecated: This endpoint has been removed.
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({
    error: 'This endpoint has been removed.'
  }, { status: 410 })
}
