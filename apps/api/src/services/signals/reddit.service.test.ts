import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getRedditAccessToken, searchRedditPosts } from './reddit.service'

// Mock ky globally
vi.mock('ky', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

// Mock @upstash/ratelimit and @upstash/redis
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow = vi.fn()
    limit = vi.fn().mockResolvedValue({ success: true })
  },
}))
vi.mock('@upstash/redis/cloudflare', () => ({
  Redis: class {},
}))

import ky from 'ky'

const mockKyPost = vi.mocked(ky.post)
const mockKyGet  = vi.mocked(ky.get)

describe('getRedditAccessToken', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns access token on success', async () => {
    mockKyPost.mockReturnValue({
      json: vi.fn().mockResolvedValue({
        access_token: 'test-token-abc123',
        token_type: 'bearer',
        expires_in: 3600,
        scope: '*',
      }),
    } as never)

    const result = await getRedditAccessToken('client-id', 'secret', 'TestAgent/1.0')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toBe('test-token-abc123')
    }
  })

  it('returns ExternalApiError when Reddit returns OAuth error', async () => {
    mockKyPost.mockReturnValue({
      json: vi.fn().mockResolvedValue({ error: 'invalid_client' }),
    } as never)

    const result = await getRedditAccessToken('bad-id', 'bad-secret', 'TestAgent/1.0')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('EXTERNAL_API_ERROR')
    }
  })

  it('returns ExternalApiError on network failure', async () => {
    mockKyPost.mockReturnValue({
      json: vi.fn().mockRejectedValue(new Error('fetch failed')),
    } as never)

    const result = await getRedditAccessToken('client-id', 'secret', 'TestAgent/1.0')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('EXTERNAL_API_ERROR')
    }
  })
})

describe('searchRedditPosts', () => {
  beforeEach(() => vi.clearAllMocks())

  const mockSearchResponse = {
    data: {
      children: [
        {
          data: {
            id: 'abc123',
            title: 'Best CRM for startups?',
            selftext: 'Looking for a CRM recommendation...',
            url: 'https://reddit.com/r/startups/comments/abc123',
            author: 'startup_guy',
            created_utc: 1700000000,
            score: 42,
            num_comments: 15,
            subreddit: 'startups',
            permalink: '/r/startups/comments/abc123/best_crm_for_startups/',
          },
        },
      ],
    },
  }

  it('returns array of RedditPosts on success', async () => {
    mockKyGet.mockReturnValue({
      json: vi.fn().mockResolvedValue(mockSearchResponse),
    } as never)

    const result = await searchRedditPosts('CRM recommendation', [], 'test-token', 'TestAgent/1.0', 10)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toHaveLength(1)
      expect(result.value[0]!.id).toBe('abc123')
      expect(result.value[0]!.author).toBe('startup_guy')
      expect(result.value[0]!.score).toBe(42)
    }
  })

  it('returns empty array when no posts found', async () => {
    mockKyGet.mockReturnValue({
      json: vi.fn().mockResolvedValue({ data: { children: [] } }),
    } as never)

    const result = await searchRedditPosts('very-obscure-keyword-xyz', [], 'test-token', 'TestAgent/1.0')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toHaveLength(0)
    }
  })

  it('returns ExternalApiError when Reddit API returns error', async () => {
    mockKyGet.mockReturnValue({
      json: vi.fn().mockResolvedValue({ error: 403, message: 'Forbidden' }),
    } as never)

    const result = await searchRedditPosts('test', [], 'bad-token', 'TestAgent/1.0')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('EXTERNAL_API_ERROR')
    }
  })

  it('returns ExternalApiError on network failure', async () => {
    mockKyGet.mockReturnValue({
      json: vi.fn().mockRejectedValue(new Error('network error')),
    } as never)

    const result = await searchRedditPosts('test', [], 'test-token', 'TestAgent/1.0')
    expect(result.isErr()).toBe(true)
  })

  it('builds subreddit-restricted URL when subreddits are specified', async () => {
    mockKyGet.mockReturnValue({
      json: vi.fn().mockResolvedValue(mockSearchResponse),
    } as never)

    await searchRedditPosts('SaaS', ['saas', 'startups'], 'test-token', 'TestAgent/1.0', 10)

    expect(mockKyGet).toHaveBeenCalledWith(
      'https://oauth.reddit.com/r/saas+startups/search.json',
      expect.any(Object),
    )
  })
})
