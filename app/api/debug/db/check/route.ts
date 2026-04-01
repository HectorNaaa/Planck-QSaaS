import { NextResponse } from 'next/server'

/**
 * Database check endpoint (Supabase removed - using internal SQLite)
 */
export async function GET() {
  return NextResponse.json({
    status: 'OK',
    database: 'SQLite (Internal)',
    message: 'Supabase removed. Using internal database.',
  })
}

