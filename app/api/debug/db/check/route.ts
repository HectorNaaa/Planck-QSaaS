import { NextResponse } from 'next/server'

/**
 * Database health check endpoint.
 */
export async function GET() {
  return NextResponse.json({
    status: 'OK',
    database: 'SQLite (Internal)',
    message: 'Internal database is operational.',
  })
}

