import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Endpoint de test/debug para login
 * Devuelve información detallada sobre qué está pasando
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    const cleanEmail = email?.toLowerCase().trim()
    
    // Paso 1: Validación básica
    if (!cleanEmail || !password) {
      return NextResponse.json({
        step: 'validation',
        success: false,
        error: 'Missing email or password',
      }, { status: 400 })
    }

    // Paso 2: Crear cliente Supabase
    const supabase = await createClient()
    
    // Paso 3: Intentar sign in
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    })

    if (authError) {
      return NextResponse.json({
        step: 'signInWithPassword',
        success: false,
        error: {
          message: authError.message,
          status: authError.status,
          code: authError.code,
          name: authError.name,
        },
        hint: 'Possible causes: user not found, wrong password, auth method not enabled in Supabase',
      }, { status: 401 })
    }

    // Paso 4: Verificar que tenemos datos del usuario
    if (!authData?.user) {
      return NextResponse.json({
        step: 'userValidation',
        success: false,
        error: 'No user data returned from Supabase',
      }, { status: 401 })
    }

    // Paso 5: Success
    return NextResponse.json({
      step: 'success',
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        createdAt: authData.user.created_at,
      },
    })
  } catch (error) {
    return NextResponse.json({
      step: 'exception',
      success: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    }, { status: 500 })
  }
}
