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

export async function checkRateLimit(limiter: Ratelimit | null, identifier: string) {
  if (!limiter) return { success: true, remaining: 999 }
  const { success, remaining, reset } = await limiter.limit(identifier)
  return { success, remaining, reset }
}
