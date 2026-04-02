import { NextResponse } from 'next/server'

/**
 * Muestra el estado de las variables de entorno internas configuradas en Vercel
 * (de forma segura, sin revelar claves completas)
 */
export async function GET() {
  const jwtSet = !!process.env.JWT_SECRET
  const openaiSet = !!process.env.OPENAI_API_KEY
  const dbDir = process.env.DB_DIR || '.data'

  return NextResponse.json({
    environment: process.env.NODE_ENV,
    vercel_url: process.env.VERCEL_URL || 'NOT SET',
    internal_db: {
      db_dir: dbDir,
      database: 'SQLite (Internal)',
    },
    auth: {
      jwt_secret_configured: jwtSet,
    },
    ai: {
      openai_configured: openaiSet,
    },
    status: {
      ready_for_auth: jwtSet,
      diagnosis: jwtSet ? '✓ JWT_SECRET set' : '❌ JWT_SECRET MISSING - Check Vercel Settings',
    },
    timestamp: new Date().toISOString(),
  })
}
