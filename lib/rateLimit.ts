// In-memory rate limiter (use Redis in production)
interface RateLimitEntry {
  count: number
  resetTime: number
  lockoutUntil?: number
}

const store = new Map<string, RateLimitEntry>()

export function rateLimit(
  key: string,
  options: {
    maxAttempts?: number
    windowMs?: number
    lockoutMs?: number
  } = {}
): { allowed: boolean; remaining: number; retryAfter?: number } {
  const maxAttempts = options.maxAttempts || 5
  const windowMs = options.windowMs || 60 * 1000 // 1 minute
  const lockoutMs = options.lockoutMs || 15 * 60 * 1000 // 15 minutes

  const now = Date.now()
  let entry = store.get(key)

  // Reset if window expired
  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + windowMs }
    store.set(key, entry)
  }

  // Check if locked out
  if (entry.lockoutUntil && now < entry.lockoutUntil) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((entry.lockoutUntil - now) / 1000),
    }
  }

  // Increment counter
  entry.count++
  entry.lockoutUntil = undefined

  // Lock out if exceeded
  if (entry.count > maxAttempts) {
    entry.lockoutUntil = now + lockoutMs
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil(lockoutMs / 1000),
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, maxAttempts - entry.count),
  }
}

export function clearRateLimit(key: string): void {
  store.delete(key)
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetTime + 60 * 60 * 1000) {
      store.delete(key)
    }
  }
}, 5 * 60 * 1000)
