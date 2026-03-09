import { describe, it, expect, vi } from 'vitest'
import { isDuplicate, markAsSeen } from './deduplication.service'

function makeRedis(storedValue: string | null = null) {
  const store = new Map<string, string>()
  if (storedValue !== null) {
    // Pre-seed the key that dedupKey would produce for a sample URL
    store.set('leadpulse:dedup:reddit.com/r/test/comments/abc123', storedValue)
  }
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => { store.set(key, value); return 'OK' }),
  }
}

const SAMPLE_URL = 'https://reddit.com/r/test/comments/abc123'

describe('isDuplicate', () => {
  it('returns false when post has not been seen', async () => {
    const redis = makeRedis(null)
    const result = await isDuplicate(redis, SAMPLE_URL)
    expect(result).toBe(false)
    expect(redis.get).toHaveBeenCalledOnce()
  })

  it('returns true when post has been seen before', async () => {
    const redis = makeRedis('1')
    const result = await isDuplicate(redis, SAMPLE_URL)
    expect(result).toBe(true)
  })

  it('normalises http:// and https:// to the same key', async () => {
    const redis = makeRedis('1') // seeded for the normalised key
    const httpResult  = await isDuplicate(redis, 'http://reddit.com/r/test/comments/abc123')
    const httpsResult = await isDuplicate(redis, 'https://reddit.com/r/test/comments/abc123')
    expect(httpResult).toBe(true)
    expect(httpsResult).toBe(true)
  })
})

describe('markAsSeen', () => {
  it('stores the key with default 7-day TTL', async () => {
    const redis = makeRedis()
    await markAsSeen(redis, SAMPLE_URL)
    expect(redis.set).toHaveBeenCalledWith(
      'leadpulse:dedup:reddit.com/r/test/comments/abc123',
      '1',
      { ex: 7 * 24 * 60 * 60 },
    )
  })

  it('stores the key with custom TTL', async () => {
    const redis = makeRedis()
    await markAsSeen(redis, SAMPLE_URL, 3600)
    expect(redis.set).toHaveBeenCalledWith(
      expect.any(String),
      '1',
      { ex: 3600 },
    )
  })
})
