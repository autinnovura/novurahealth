import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = process.env.UPSTASH_REDIS_REST_URL ? Redis.fromEnv() : null

export const chatLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '1 m'),
      analytics: true,
      prefix: 'rl:chat',
    })
  : null

export const importLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '10 m'),
      analytics: true,
      prefix: 'rl:import',
    })
  : null

export const standardLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '1 m'),
      analytics: true,
      prefix: 'rl:std',
    })
  : null

// Auth limiter: stricter window, fails CLOSED when Redis is unavailable
export const authLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '15 m'),
      analytics: true,
      prefix: 'rl:auth',
    })
  : null

// Password reset: very strict to prevent email enumeration
export const resetLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, '15 m'),
      analytics: true,
      prefix: 'rl:reset',
    })
  : null

/**
 * Standard rate limit check — fails OPEN (allows requests if Redis is down).
 * Use for authenticated routes where abuse is bounded by session.
 */
export async function checkRateLimit(limiter: Ratelimit | null, identifier: string) {
  if (!limiter) return { success: true, remaining: 999 }
  const { success, remaining, reset } = await limiter.limit(identifier)
  return { success, remaining, reset }
}

/**
 * Auth rate limit check — fails CLOSED (blocks requests if Redis is down).
 * Use for unauthenticated routes vulnerable to brute force / enumeration.
 */
export async function checkAuthRateLimit(limiter: Ratelimit | null, identifier: string) {
  if (!limiter) {
    // Redis not configured — fail closed in production, open in dev
    if (process.env.NODE_ENV === 'production') {
      return { success: false, remaining: 0 }
    }
    return { success: true, remaining: 999 }
  }
  try {
    const { success, remaining, reset } = await limiter.limit(identifier)
    return { success, remaining, reset }
  } catch {
    // Redis error — fail closed
    return { success: false, remaining: 0 }
  }
}
