import { NextResponse } from 'next/server'

/**
 * Muestra las variables de entorno configuradas en Vercel
 * (de forma segura, sin revelar claves completas)
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET'
  const keyStart = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY 
    ? `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 15)}...` 
    : 'NOT SET'

  return NextResponse.json({
    environment: process.env.NODE_ENV,
    vercel_url: process.env.VERCEL_URL || 'NOT SET',
    supabase: {
      url_configured: url !== 'NOT SET',
      url_value: url,
      url_valid: url.includes('supabase.co'),
      key_configured: keyStart !== 'NOT SET',
      key_preview: keyStart,
    },
    status: {
      ready_for_auth: url !== 'NOT SET' && keyStart !== 'NOT SET',
      diagnosis: url.includes('supabase.co') ? '✓ URL OK' : '❌ URL INVALID - Check Vercel Settings',
    },
    timestamp: new Date().toISOString(),
  })
}
