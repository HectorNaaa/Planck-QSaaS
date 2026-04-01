import { NextResponse } from 'next/server'

/**
 * Endpoint que muestra las variables de entorno de Supabase (primeros caracteres)
 * Para debugging
 */
export async function GET() {
  return NextResponse.json({
    env_vars: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY 
        ? `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...`
        : 'NOT SET',
    },
    note: 'These are your environment variables configured in Vercel',
  })
}
