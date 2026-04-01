import { NextRequest, NextResponse } from 'next/server'

/**
 * Test endpoint - simplemente echo el body que recibe
 * Sin ningún procesamiento
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    return NextResponse.json({
      received: body,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 400 })
  }
}
