import { NextResponse } from 'next/server'

/**
 * Endpoint que usa Admin API (sin RLS) para hacer diagnóstico
 * NOTA: Requiere SUPABASE_SERVICE_KEY en variables de entorno
 */
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({
        status: 'ERROR',
        message: 'Missing SUPABASE_SERVICE_ROLE_KEY in environment',
        summary: 'This is required for admin operations',
      }, { status: 500 })
    }

    // Intentar conexión a la API de Supabase directamente
    const adminUrl = `${supabaseUrl}/auth/v1/admin/users`
    
    console.log('[ADMIN-DIAG] Attempting admin API call to:', adminUrl.substring(0, 50) + '...')

    try {
      const response = await fetch(adminUrl, {
        method: 'GET',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      return NextResponse.json({
        status: response.ok ? 'SUCCESS' : 'ERROR',
        statusCode: response.statusCode,
        message: response.ok ? 'Admin API is responding' : 'Admin API error',
        userCount: data?.users?.length || 0,
        users: data?.users?.map((u: any) => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
        })) || [],
        rawStatus: response.status,
        rawStatusText: response.statusText,
      })
    } catch (apiError) {
      return NextResponse.json({
        status: 'ERROR',
        message: 'Admin API call failed',
        error: apiError instanceof Error ? apiError.message : String(apiError),
        debug: 'Check if SUPABASE_SERVICE_ROLE_KEY is configured correctly',
      }, { status: 500 })
    }
  } catch (error) {
    return NextResponse.json({
      status: 'ERROR',
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
