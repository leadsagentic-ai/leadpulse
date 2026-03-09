import { createMiddleware } from 'hono/factory'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis/cloudflare'
import { logger } from '@/lib/logger'

interface RateLimitOptions {
  /** Max requests allowed per window */
  limit: number
  /** Window size in seconds */
  window: number
}

export function rateLimitMiddleware(options: RateLimitOptions) {
  return createMiddleware<{
    Bindings: { UPSTASH_REDIS_REST_URL: string; UPSTASH_REDIS_REST_TOKEN: string }
    Variables: { userId: string }
  }>(async (c, next) => {
    const redis = new Redis({
      url: c.env.UPSTASH_REDIS_REST_URL,
      token: c.env.UPSTASH_REDIS_REST_TOKEN,
    })

    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(options.limit, `${options.window} s`),
      prefix: 'leadpulse:rl',
    })

    // Rate limit by userId when authenticated, otherwise by IP
    const identifier = c.get('userId') ?? c.req.header('CF-Connecting-IP') ?? 'anonymous'

    const { success, limit, remaining, reset } = await ratelimit.limit(identifier)

    c.res.headers.set('X-RateLimit-Limit', String(limit))
    c.res.headers.set('X-RateLimit-Remaining', String(remaining))
    c.res.headers.set('X-RateLimit-Reset', String(reset))

    if (!success) {
      logger.warn({ identifier, limit, window: options.window }, 'Rate limit exceeded')
      return c.json(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' } },
        429,
      )
    }

    await next()
  })
}
