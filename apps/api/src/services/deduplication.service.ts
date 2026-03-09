import { logger } from '@/lib/logger'

const DEDUP_PREFIX = 'leadpulse:dedup:'
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days

// Redis client interface — accepts the Upstash Redis instance.
// We use duck-typing to avoid importing the Redis class directly here
// (keeps this service testable with a simple mock).
interface RedisClient {
  get(key: string): Promise<string | null>
  set(key: string, value: string, opts?: { ex?: number }): Promise<unknown>
}

function dedupKey(postUrl: string): string {
  // Normalise URL: strip protocol variance and trailing slashes
  const normalised = postUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return `${DEDUP_PREFIX}${normalised}`
}

/**
 * Returns true if this postUrl has been seen within the last TTL window.
 */
export async function isDuplicate(redis: RedisClient, postUrl: string): Promise<boolean> {
  const key = dedupKey(postUrl)
  const value = await redis.get(key)
  const duplicate = value !== null
  if (duplicate) {
    logger.info({ postUrl }, 'Duplicate signal detected — skipping')
  }
  return duplicate
}

/**
 * Marks a postUrl as seen. Defaults to 7-day TTL.
 */
export async function markAsSeen(
  redis: RedisClient,
  postUrl: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<void> {
  const key = dedupKey(postUrl)
  await redis.set(key, '1', { ex: ttlSeconds })
  logger.info({ postUrl, ttlSeconds }, 'Signal marked as seen')
}
