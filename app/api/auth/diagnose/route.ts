import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Endpoint de diagnóstico - intenta loguear y muestra el error exacto de Supabase
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email = 'test@example.com', password = 'testpass123' } = body

    console.log('[AUTH-DIAG] Attempting login with:', email)

    const supabase = await createClient()

    // Intenta loguear
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    })

    if (authError) {
      console.error('[AUTH-DIAG] Error from Supabase:', authError)
      
      return NextResponse.json({
        status: 'ERROR',
        message: 'Authentication failed',
        error: {
          message: authError.message,
          code: authError.code,
          status: authError.status,
          name: authError.name,
        },
        diagnosis: `
          Posibles causas:
          1. El usuario "${email}" no existe en auth.users
          2. La contraseña es incorrecta
          3. Email auth no está habilitada en Supabase
          4. El usuario está deshabilitado
          5. RLS policies están bloqueando
        `,
        suggestion: 'Ve a Supabase Dashboard → Authentication → Users y verifica que el usuario exista',
      }, { status: 401 })
    }

    return NextResponse.json({
      status: 'SUCCESS',
      message: 'Login successful',
      user: {
        id: authData.user?.id,
        email: authData.user?.email,
      },
    })
  } catch (error) {
    console.error('[AUTH-DIAG] Exception:', error)
    return NextResponse.json({
      status: 'ERROR',
      message: error instanceof Error ? error.message : String(error),
      trace: error instanceof Error ? error.stack : undefined,
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    description: 'POST with {email, password} to test auth',
    example: {
      email: 'test@example.com',
      password: 'testpass123',
    },
  })
}
