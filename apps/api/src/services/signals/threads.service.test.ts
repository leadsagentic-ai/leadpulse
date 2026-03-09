import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchThreadsPosts } from './threads.service'

vi.mock('ky', () => ({
  default: {
    get: vi.fn(),
  },
}))

import ky from 'ky'

const mockKyGet = vi.mocked(ky.get)

const mockSearchResponse = {
  data: [
    {
      id:             '18012345678901234',
      text:           'Anyone have recommendations for CRM software for a 50-person team?',
      permalink:      'https://www.threads.net/@startupfounder/post/abc123',
      timestamp:      '2026-01-15T09:30:00+0000',
      username:       'startupfounder',
      likes_count:    24,
      replies_count:  8,
    },
  ],
}

describe('searchThreadsPosts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns posts on success', async () => {
    mockKyGet.mockReturnValue({
      json: vi.fn().mockResolvedValue(mockSearchResponse),
    } as never)

    const result = await searchThreadsPosts('CRM recommendation', 'test-access-token', 10)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toHaveLength(1)
      const post = result.value[0]!
      expect(post.text).toBe('Anyone have recommendations for CRM software for a 50-person team?')
      expect(post.username).toBe('startupfounder')
      expect(post.likeCount).toBe(24)
      expect(post.replyCount).toBe(8)
      expect(post.url).toBe('https://www.threads.net/@startupfounder/post/abc123')
    }
  })

  it('returns empty array when no posts found', async () => {
    mockKyGet.mockReturnValue({
      json: vi.fn().mockResolvedValue({ data: [] }),
    } as never)

    const result = await searchThreadsPosts('very-obscure-keyword-xyz', 'token')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toHaveLength(0)
    }
  })

  it('filters out items with no text', async () => {
    const responseWithNoText = {
      data: [
        { id: 'p1', text: 'Valid post', permalink: 'https://threads.net/p1', timestamp: '2026-01-15T09:00:00+0000', username: 'user1', likes_count: 5, replies_count: 1 },
        { id: 'p2', text: undefined, permalink: 'https://threads.net/p2', timestamp: '2026-01-15T09:00:00+0000', username: 'user2' },
      ],
    }
    mockKyGet.mockReturnValue({
      json: vi.fn().mockResolvedValue(responseWithNoText),
    } as never)

    const result = await searchThreadsPosts('test', 'token')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toHaveLength(1)
      expect(result.value[0]!.text).toBe('Valid post')
    }
  })

  it('returns ExternalApiError on Meta API error', async () => {
    mockKyGet.mockReturnValue({
      json: vi.fn().mockResolvedValue({
        error: { message: 'Invalid OAuth access token', type: 'OAuthException', code: 190 },
      }),
    } as never)

    const result = await searchThreadsPosts('test', 'bad-token')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('EXTERNAL_API_ERROR')
    }
  })

  it('returns ExternalApiError on network failure', async () => {
    mockKyGet.mockReturnValue({
      json: vi.fn().mockRejectedValue(new Error('network error')),
    } as never)

    const result = await searchThreadsPosts('test', 'token')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('EXTERNAL_API_ERROR')
    }
  })

  it('falls back to constructed URL when permalink is missing', async () => {
    const responseNoPermalink = {
      data: [
        { id: 'p3', text: 'Post without permalink', username: 'user3', timestamp: '2026-01-15T09:00:00+0000' },
      ],
    }
    mockKyGet.mockReturnValue({
      json: vi.fn().mockResolvedValue(responseNoPermalink),
    } as never)

    const result = await searchThreadsPosts('test', 'token')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value[0]!.url).toBe('https://www.threads.net/@user3')
    }
  })
})
