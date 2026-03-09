import { Redis } from '@upstash/redis'

// Factory — called per Worker request with env bindings
// @upstash/redis uses REST (HTTP) — works in Cloudflare Workers (no TCP needed)
export function createRedis(restUrl: string, restToken: string): Redis {
  return new Redis({ url: restUrl, token: restToken })
}

export type RedisClient = Redis
