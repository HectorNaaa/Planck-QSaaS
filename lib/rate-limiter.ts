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
