// Deprecated: This endpoint is no longer available. Supabase admin API has been removed.
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ERROR',
    message: 'This endpoint has been removed. Supabase admin API is no longer supported.',
  }, { status: 410 })
}
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
