// Deprecated: This endpoint has been removed.
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ERROR',
    message: 'This endpoint has been removed.'
  }, { status: 410 });
}
