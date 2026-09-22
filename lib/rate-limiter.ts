/**
 * Rate Limiter - Prevents API abuse with token bucket algorithm
 * Limits: 1 request per 3 seconds per user/IP
 */

interface RateLimitStore {
  tokens: number
  lastRefill: number
}

const store = new Map<string, RateLimitStore>()

const MAX_TOKENS = 1
const REFILL_RATE = 3000 // 3 seconds in ms
// Real enforced limit — must match the documented/advertised API + SDK limit (1MB).
// Previously this constant was 100MB while error messages and docs said "1MB max",
// so oversized bodies were fully parsed (CPU/memory cost) before ever being rejected.
const MAX_PAYLOAD_SIZE = 1024 * 1024 // 1MB

/**
 * Check if a request should be rate limited
 * @param identifier - User ID or IP address
 * @returns true if request should be allowed
 */
export function checkRateLimit(identifier: string): boolean {
  const now = Date.now()
  const bucket = store.get(identifier)

  if (!bucket) {
    // First request from this identifier
    store.set(identifier, {
      tokens: MAX_TOKENS - 1,
      lastRefill: now,
    })
    return true
  }

  // Calculate tokens to add based on time elapsed
  const timeSinceLastRefill = now - bucket.lastRefill
  const tokensToAdd = Math.floor(timeSinceLastRefill / REFILL_RATE)

  if (tokensToAdd > 0) {
    bucket.tokens = Math.min(MAX_TOKENS, bucket.tokens + tokensToAdd)
    bucket.lastRefill = now
  }

  // Check if we have tokens available
  if (bucket.tokens > 0) {
    bucket.tokens -= 1
    return true
  }

  return false
}

/**
 * Get time until next token is available
 * @param identifier - User ID or IP address
 * @returns milliseconds until next request is allowed
 */
export function getRetryAfter(identifier: string): number {
  const bucket = store.get(identifier)
  if (!bucket) return 0

  const now = Date.now()
  const timeSinceLastRefill = now - bucket.lastRefill
  const timeUntilNextToken = REFILL_RATE - timeSinceLastRefill

  return Math.max(0, timeUntilNextToken)
}

/**
 * Validate payload size
 * @param payload - Request payload object
 * @returns true if payload is within size limits
 */
export function validatePayloadSize(payload: any): boolean {
  const size = JSON.stringify(payload).length
  return size <= MAX_PAYLOAD_SIZE
}

export const RATE_LIMITER_MAX_PAYLOAD_BYTES = MAX_PAYLOAD_SIZE

/**
 * Reads a request body up to `maxBytes` of ACTUAL received bytes — enforced
 * on the raw stream, before JSON.parse, and independent of any (possibly
 * missing or spoofed) Content-Length header. Returns a 413-style result if
 * the real byte count exceeds the limit, without ever buffering more than
 * `maxBytes + 1` bytes.
 */
export async function readJsonWithByteLimit(
  request: Request,
  maxBytes: number = MAX_PAYLOAD_SIZE,
): Promise<{ ok: true; data: any } | { ok: false; status: 413 | 400; error: string }> {
  const reader = request.body?.getReader()
  if (!reader) {
    // No body stream available (e.g. some test mocks) — fall back to json() but still bound the check.
    try {
      const data = await request.json()
      if (!validatePayloadSize(data)) {
        return { ok: false, status: 413, error: `Payload too large. Maximum size is ${maxBytes} bytes.` }
      }
      return { ok: true, data }
    } catch {
      return { ok: false, status: 400, error: "Invalid JSON body" }
    }
  }

  let received = 0
  const chunks: Uint8Array[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      received += value.byteLength
      if (received > maxBytes) {
        await reader.cancel().catch(() => {})
        return { ok: false, status: 413, error: `Payload too large. Maximum size is ${maxBytes} bytes.` }
      }
      chunks.push(value)
    }
  }

  if (chunks.length === 0) return { ok: true, data: {} }
  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)))
  try {
    return { ok: true, data: JSON.parse(buffer.toString("utf8")) }
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON body" }
  }
}

/**
 * Clear old entries from the rate limit store
 * Call this periodically to prevent memory leaks
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now()
  const maxAge = REFILL_RATE * 10 // Keep entries for 30 seconds

  for (const [key, bucket] of store.entries()) {
    if (now - bucket.lastRefill > maxAge) {
      store.delete(key)
    }
  }
}

// Auto-cleanup every 60 seconds
if (typeof setInterval !== "undefined") {
  setInterval(cleanupRateLimitStore, 60000)
}
