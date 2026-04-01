import { NextResponse } from 'next/server'

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'OK',
    message: 'Application is healthy',
    database: 'SQLite (Internal)',
  })
}
