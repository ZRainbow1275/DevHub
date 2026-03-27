/**
 * IPC rate limiter — prevents abuse from renderer process.
 * Uses a sliding window per-channel counter with 60s reset.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimiter = new Map<string, RateLimitEntry>()

/** Rate limit tiers (requests per minute) */
export const RATE_LIMITS = {
  SCAN: 12,
  ACTION: 30,
  QUERY: 60
} as const

/**
 * Wraps an IPC handler with rate limiting.
 * Throws an Error if the rate limit is exceeded for the given channel.
 *
 * @param channel - IPC channel name (used as the rate limit key)
 * @param maxPerMinute - Maximum allowed invocations per 60-second window
 * @param handler - The actual handler function
 * @returns A wrapped handler that enforces the rate limit
 */
export function withRateLimit<TArgs extends unknown[], TReturn>(
  channel: string,
  maxPerMinute: number,
  handler: (...args: TArgs) => TReturn
): (...args: TArgs) => TReturn {
  return (...args: TArgs): TReturn => {
    const now = Date.now()
    const entry = rateLimiter.get(channel)

    if (entry && now < entry.resetAt && entry.count >= maxPerMinute) {
      throw new Error(`Rate limit exceeded for ${channel}`)
    }

    if (!entry || now >= entry.resetAt) {
      rateLimiter.set(channel, { count: 1, resetAt: now + 60_000 })
    } else {
      entry.count++
    }

    // Periodic cleanup of expired entries to prevent memory leak
    if (rateLimiter.size > 50) {
      for (const [key, val] of rateLimiter) {
        if (now >= val.resetAt) rateLimiter.delete(key)
      }
    }

    return handler(...args)
  }
}

/**
 * Reset all rate limit counters (useful for testing).
 */
export function resetRateLimits(): void {
  rateLimiter.clear()
}
