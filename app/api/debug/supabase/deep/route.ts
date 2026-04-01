import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Diagnóstico profundo de Supabase
 * Intenta hacer varias queries para ver cuál está fallando
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const results: any = {}

    // Test 1: Conectar a la DB
    try {
      const { data, error } = await supabase.from('profiles').select('count(*)', { count: 'exact' })
      results.profiles_query = {
        success: !error,
        error: error?.message,
        data,
      }
    } catch (e) {
      results.profiles_query = { success: false, error: (e as Error).message }
    }

    // Test 2: Obtener usuarios
    try {
      const { data, error } = await supabase.auth.admin.listUsers()
      results.list_users = {
        success: !error,
        error: error?.message,
        userCount: data?.users?.length || 0,
      }
    } catch (e) {
      results.list_users = { success: false, error: (e as Error).message }
    }

    // Test 3: Ver RLS policies
    try {
      const { data, error } = await supabase
        .from('information_schema.triggers')
        .select('*')
      results.triggers = {
        success: !error,
        error: error?.message,
        count: data?.length || 0,
      }
    } catch (e) {
      results.triggers = { success: false, error: (e as Error).message }
    }

    // Test 4: Ver tabla public.schema
    try {
      const { data, error } = await supabase.rpc('get_tables', {})
      results.rpc_get_tables = {
        success: !error,
        error: error?.message,
      }
    } catch (e) {
      results.rpc_get_tables = { success: false, error: (e as Error).message }
    }

    return NextResponse.json({
      status: 'diagnostic',
      timestamp: new Date().toISOString(),
      results,
      summary: {
        profiles_accessible: results.profiles_query?.success || false,
        auth_working: results.list_users?.success || false,
        total_users: results.list_users?.userCount || 0,
      },
      next_step: 'If profiles_query fails with "new row violates row-level security policy", RLS policies are blocking anon access',
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      suggestion: 'Check Supabase Project Status page for service health',
    }, { status: 500 })
  }
}
