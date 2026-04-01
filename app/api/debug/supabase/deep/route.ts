// Deprecated: This endpoint is no longer available. Supabase diagnostics have been removed.
export async function GET() {
  return new Response(JSON.stringify({
    error: 'This endpoint has been removed. Supabase diagnostics are no longer supported.'
  }), { status: 410, headers: { 'Content-Type': 'application/json' } });
}
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      suggestion: 'Check Supabase Project Status page for service health',
    }, { status: 500 })
  }
}
