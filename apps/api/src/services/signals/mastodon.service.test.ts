import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchMastodonPosts } from './mastodon.service'

vi.mock('ky', () => ({
  default: {
    get: vi.fn(),
  },
}))

import ky from 'ky'

const mockKyGet = vi.mocked(ky.get)

const mockSearchResponse = {
  statuses: [
    {
      id:          '112345678901234567',
      url:         'https://mastodon.social/@devfounder/112345678901234567',
      content:     '<p>Looking for a <strong>CRM tool</strong> that integrates with Slack.<br/>Any recommendations?</p>',
      created_at:  '2026-01-15T08:00:00.000Z',
      account: {
        acct:         'devfounder@mastodon.social',
        url:          'https://mastodon.social/@devfounder',
        display_name: 'Dev Founder',
      },
      replies_count:    3,
      reblogs_count:    2,
      favourites_count: 14,
    },
  ],
}

describe('searchMastodonPosts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns statuses on success', async () => {
    mockKyGet.mockReturnValue({
      json: vi.fn().mockResolvedValue(mockSearchResponse),
    } as never)

    const result = await searchMastodonPosts('CRM recommendation', 'https://mastodon.social', 10)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toHaveLength(1)
      const status = result.value[0]!
      expect(status.id).toBe('112345678901234567')
      expect(status.author).toBe('devfounder@mastodon.social')
      expect(status.repliesCount).toBe(3)
      expect(status.reblogsCount).toBe(2)
      expect(status.favouritesCount).toBe(14)
    }
  })

  it('strips HTML tags from content to produce plainText', async () => {
    mockKyGet.mockReturnValue({
      json: vi.fn().mockResolvedValue(mockSearchResponse),
    } as never)

    const result = await searchMastodonPosts('CRM')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      const status = result.value[0]!
      // HTML should be stripped
      expect(status.plainText).not.toContain('<p>')
      expect(status.plainText).not.toContain('<strong>')
      expect(status.plainText).not.toContain('<br/>')
      // Content should be preserved
      expect(status.plainText).toContain('CRM tool')
      expect(status.plainText).toContain('Any recommendations')
    }
  })

  it('decodes HTML entities in plainText', async () => {
    const responseWithEntities = {
      statuses: [{
        ...mockSearchResponse.statuses[0]!,
        content: '<p>A &amp; B &lt;test&gt; &quot;quoted&quot; &#39;apos&#39;</p>',
      }],
    }
    mockKyGet.mockReturnValue({
      json: vi.fn().mockResolvedValue(responseWithEntities),
    } as never)

    const result = await searchMastodonPosts('test')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value[0]!.plainText).toBe("A & B <test> \"quoted\" 'apos'")
    }
  })

  it('returns empty array when no statuses found', async () => {
    mockKyGet.mockReturnValue({
      json: vi.fn().mockResolvedValue({ statuses: [], accounts: [], hashtags: [] }),
    } as never)

    const result = await searchMastodonPosts('very-obscure-keyword-xyz')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toHaveLength(0)
    }
  })

  it('returns ExternalApiError on Mastodon API error', async () => {
    mockKyGet.mockReturnValue({
      json: vi.fn().mockResolvedValue({ error: 'Record not found' }),
    } as never)

    const result = await searchMastodonPosts('test')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('EXTERNAL_API_ERROR')
    }
  })

  it('returns ExternalApiError on network failure', async () => {
    mockKyGet.mockReturnValue({
      json: vi.fn().mockRejectedValue(new Error('network error')),
    } as never)

    const result = await searchMastodonPosts('test')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('EXTERNAL_API_ERROR')
    }
  })

  it('uses custom instance URL when provided', async () => {
    mockKyGet.mockReturnValue({
      json: vi.fn().mockResolvedValue({ statuses: [] }),
    } as never)

    await searchMastodonPosts('test', 'https://fosstodon.org', 10)

    expect(mockKyGet).toHaveBeenCalledWith(
      'https://fosstodon.org/api/v2/search',
      expect.objectContaining({
        searchParams: expect.objectContaining({ q: 'test' }),
      }),
    )
  })
})
