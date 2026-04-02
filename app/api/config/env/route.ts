import { NextResponse } from 'next/server'

/**
 * Endpoint de debugging: muestra el estado de variables de entorno internas.
 */
export async function GET() {
  return NextResponse.json({
    env_vars: {
      JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET',
      DB_DIR: process.env.DB_DIR || '.data (default)',
      NODE_ENV: process.env.NODE_ENV || 'development',
    },
    database: 'SQLite (Internal)',
    note: 'These are your environment variables configured in Vercel',
  })
}
