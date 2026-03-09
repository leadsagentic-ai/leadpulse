import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchBlueskyPosts } from './bluesky.service'

// Mock ky globally
vi.mock('ky', () => ({
  default: {
    get: vi.fn(),
  },
}))

import ky from 'ky'

const mockKyGet = vi.mocked(ky.get)

const mockSearchResponse = {
  posts: [
    {
      uri:    'at://did:plc:abc123/app.bsky.feed.post/3kwrkey1',
      cid:    'bafyabc123',
      author: {
        did:         'did:plc:abc123',
        handle:      'saas_buyer.bsky.social',
        displayName: 'SaaS Buyer',
      },
      record: {
        text:      'Looking for a good CRM tool for our growing startup',
        createdAt: '2026-01-15T10:00:00.000Z',
        '$type':   'app.bsky.feed.post',
      },
      likeCount:   12,
      repostCount: 3,
      replyCount:  5,
    },
  ],
}

describe('searchBlueskyPosts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns posts on success', async () => {
    mockKyGet.mockReturnValue({
      json: vi.fn().mockResolvedValue(mockSearchResponse),
    } as never)

    const result = await searchBlueskyPosts('CRM recommendation', 10)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toHaveLength(1)
      const post = result.value[0]!
      expect(post.text).toBe('Looking for a good CRM tool for our growing startup')
      expect(post.author).toBe('saas_buyer.bsky.social')
      expect(post.authorDid).toBe('did:plc:abc123')
      expect(post.likeCount).toBe(12)
      expect(post.repostCount).toBe(3)
      expect(post.replyCount).toBe(5)
    }
  })

  it('builds a correct bsky.app URL from AT URI', async () => {
    mockKyGet.mockReturnValue({
      json: vi.fn().mockResolvedValue(mockSearchResponse),
    } as never)

    const result = await searchBlueskyPosts('CRM')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value[0]!.url).toBe(
        'https://bsky.app/profile/saas_buyer.bsky.social/post/3kwrkey1',
      )
    }
  })

  it('returns empty array when no posts found', async () => {
    mockKyGet.mockReturnValue({
      json: vi.fn().mockResolvedValue({ posts: [] }),
    } as never)

    const result = await searchBlueskyPosts('very-obscure-keyword-xyz')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toHaveLength(0)
    }
  })

  it('defaults missing engagement counts to 0', async () => {
    const responseWithoutCounts = {
      posts: [
        {
          ...mockSearchResponse.posts[0],
          likeCount:   undefined,
          repostCount: undefined,
          replyCount:  undefined,
        },
      ],
    }
    mockKyGet.mockReturnValue({
      json: vi.fn().mockResolvedValue(responseWithoutCounts),
    } as never)

    const result = await searchBlueskyPosts('test')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      const post = result.value[0]!
      expect(post.likeCount).toBe(0)
      expect(post.repostCount).toBe(0)
      expect(post.replyCount).toBe(0)
    }
  })

  it('returns ExternalApiError on AT Protocol API error', async () => {
    mockKyGet.mockReturnValue({
      json: vi.fn().mockResolvedValue({ error: 'InvalidQuery', message: 'Query too short' }),
    } as never)

    const result = await searchBlueskyPosts('a')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('EXTERNAL_API_ERROR')
    }
  })

  it('returns ExternalApiError on network failure', async () => {
    mockKyGet.mockReturnValue({
      json: vi.fn().mockRejectedValue(new Error('network error')),
    } as never)

    const result = await searchBlueskyPosts('test')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('EXTERNAL_API_ERROR')
    }
  })
})
