// Deprecated: This endpoint has been removed.
export async function GET() {
  return new Response(JSON.stringify({
    error: 'This endpoint has been removed.'
  }), { status: 410, headers: { 'Content-Type': 'application/json' } });
}
