import { NextRequest, NextResponse } from 'next/server'

/**
 * Endpoint de diagnóstico RAW - solo muestra qué recibe sin procesar
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[RAW-DEBUG] Headers:', {
      contentType: request.headers.get('content-type'),
      contentLength: request.headers.get('content-length'),
    })

    // Intentar leer el body de diferentes formas
    const arrayBuffer = await request.arrayBuffer()
    const text = new TextDecoder().decode(arrayBuffer)
    
    console.log('[RAW-DEBUG] Body as text:', text)
    console.log('[RAW-DEBUG] Body length:', text.length)

    let parsed = null
    try {
      if (text) {
        parsed = JSON.parse(text)
      }
    } catch (e) {
      console.log('[RAW-DEBUG] Failed to parse as JSON')
    }

    return NextResponse.json({
      status: 'debug',
      headers: {
        contentType: request.headers.get('content-type'),
        contentLength: request.headers.get('content-length'),
      },
      body: {
        rawText: text,
        textLength: text.length,
        parsed: parsed,
      },
    })
  } catch (error) {
    console.error('[RAW-DEBUG] Error:', error)
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
