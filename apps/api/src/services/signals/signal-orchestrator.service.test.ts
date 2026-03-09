import { describe, it, expect, vi, beforeEach } from 'vitest'
import { pollPlatformsForCampaign } from './signal-orchestrator.service'
import type { CampaignSignalConfig, OrchestratorEnv } from './signal-orchestrator.service'

// Mock all platform services
vi.mock('./reddit.service', () => ({
  getRedditAccessToken: vi.fn(),
  searchRedditPosts:    vi.fn(),
}))
vi.mock('./bluesky.service', () => ({
  searchBlueskyPosts: vi.fn(),
}))
vi.mock('./threads.service', () => ({
  searchThreadsPosts: vi.fn(),
}))
vi.mock('./mastodon.service', () => ({
  searchMastodonPosts: vi.fn(),
}))
vi.mock('@/services/deduplication.service', () => ({
  isDuplicate: vi.fn(),
  markAsSeen:  vi.fn(),
}))
vi.mock('@upstash/redis/cloudflare', () => ({
  Redis: class {},
}))

import { ok, err } from 'neverthrow'
import { getRedditAccessToken, searchRedditPosts } from './reddit.service'
import { searchBlueskyPosts } from './bluesky.service'
import { searchThreadsPosts } from './threads.service'
import { searchMastodonPosts } from './mastodon.service'
import { isDuplicate, markAsSeen } from '@/services/deduplication.service'
import { ExternalApiError } from '@/lib/errors'

const mockGetToken  = vi.mocked(getRedditAccessToken)
const mockReddit    = vi.mocked(searchRedditPosts)
const mockBluesky   = vi.mocked(searchBlueskyPosts)
const mockThreads   = vi.mocked(searchThreadsPosts)
const mockMastodon  = vi.mocked(searchMastodonPosts)
const mockIsDup     = vi.mocked(isDuplicate)
const mockMarkSeen  = vi.mocked(markAsSeen)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRedis = {} as any

const mockQueueSend = vi.fn()
const env: OrchestratorEnv = {
  UPSTASH_REDIS_REST_URL:   'https://redis.example.com',
  UPSTASH_REDIS_REST_TOKEN: 'token',
  REDDIT_CLIENT_ID:         'reddit-id',
  REDDIT_CLIENT_SECRET:     'reddit-secret',
  REDDIT_USER_AGENT:        'TestAgent/1.0',
  THREADS_ACCESS_TOKEN:     'threads-token',
  SIGNAL_QUEUE:             { send: mockQueueSend } as never,
}

const campaign: CampaignSignalConfig = {
  id:               'campaign-uuid-001',
  userId:           'user-uuid-001',
  keywords:         ['CRM recommendation'],
  platforms:        ['bluesky'],
  subredditTargets: [],
}

describe('pollPlatformsForCampaign', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsDup.mockResolvedValue(false)
    mockMarkSeen.mockResolvedValue(undefined)
    mockQueueSend.mockResolvedValue(undefined)
  })

  it('calls Bluesky service when platform includes bluesky', async () => {
    mockBluesky.mockResolvedValue(ok([
      {
        uri:         'at://did:plc:abc/app.bsky.feed.post/rkey1',
        cid:         'bafyabc',
        text:        'Looking for CRM tool',
        author:      'user.bsky.social',
        authorDid:   'did:plc:abc',
        createdAt:   '2026-01-15T10:00:00.000Z',
        likeCount:   5,
        repostCount: 1,
        replyCount:  2,
        url:         'https://bsky.app/profile/user.bsky.social/post/rkey1',
      },
    ]))

    const result = await pollPlatformsForCampaign(mockRedis, campaign, env)

    expect(result.isOk()).toBe(true)
    expect(mockBluesky).toHaveBeenCalledWith('CRM recommendation', 25)
    expect(mockQueueSend).toHaveBeenCalledTimes(1)
    const msg = mockQueueSend.mock.calls[0]![0]
    expect(msg.platform).toBe('bluesky')
    expect(msg.campaignId).toBe('campaign-uuid-001')
    if (result.isOk()) expect(result.value).toBe(1)
  })

  it('calls Reddit service when platform includes reddit', async () => {
    const redditCampaign: CampaignSignalConfig = { ...campaign, platforms: ['reddit'] }
    mockGetToken.mockResolvedValue(ok('reddit-access-token'))
    mockReddit.mockResolvedValue(ok([
      {
        id:          'post123',
        title:       'Which CRM should I use?',
        selftext:    'Details here',
        url:         'https://reddit.com/r/startups/comments/post123/which_crm',
        author:      'startup_founder',
        created_utc: 1736932800,
        score:       45,
        num_comments: 12,
        subreddit:   'startups',
        permalink:   '/r/startups/comments/post123/which_crm',
      },
    ]))

    const result = await pollPlatformsForCampaign(mockRedis, redditCampaign, env)

    expect(result.isOk()).toBe(true)
    expect(mockGetToken).toHaveBeenCalledTimes(1)
    expect(mockQueueSend).toHaveBeenCalledTimes(1)
    const msg = mockQueueSend.mock.calls[0]![0]
    expect(msg.platform).toBe('reddit')
    if (result.isOk()) expect(result.value).toBe(1)
  })

  it('calls Mastodon service when platform includes mastodon', async () => {
    const mastodonCampaign: CampaignSignalConfig = { ...campaign, platforms: ['mastodon'] }
    mockMastodon.mockResolvedValue(ok([
      {
        id:              '112345',
        url:             'https://mastodon.social/@user/112345',
        content:         '<p>CRM recommendations?</p>',
        plainText:       'CRM recommendations?',
        author:          'user@mastodon.social',
        authorUrl:       'https://mastodon.social/@user',
        createdAt:       '2026-01-15T08:00:00.000Z',
        repliesCount:    2,
        reblogsCount:    1,
        favouritesCount: 7,
      },
    ]))

    const result = await pollPlatformsForCampaign(mockRedis, mastodonCampaign, env)

    expect(result.isOk()).toBe(true)
    expect(mockMastodon).toHaveBeenCalledWith('CRM recommendation', 'https://mastodon.social', 25)
    expect(mockQueueSend).toHaveBeenCalledTimes(1)
    const msg = mockQueueSend.mock.calls[0]![0]
    expect(msg.platform).toBe('mastodon')
  })

  it('skips already-seen posts via deduplication', async () => {
    mockBluesky.mockResolvedValue(ok([
      {
        uri: 'at://x/y/z', cid: 'cid1', text: 'dupe post', author: 'alice.bsky.social',
        authorDid: 'did:plc:1', createdAt: '2026-01-01T00:00:00Z',
        likeCount: 0, repostCount: 0, replyCount: 0,
        url: 'https://bsky.app/profile/alice.bsky.social/post/z',
      },
    ]))
    // Mark as already seen
    mockIsDup.mockResolvedValue(true)

    const result = await pollPlatformsForCampaign(mockRedis, campaign, env)

    expect(result.isOk()).toBe(true)
    expect(mockMarkSeen).not.toHaveBeenCalled()
    expect(mockQueueSend).not.toHaveBeenCalled()
    if (result.isOk()) expect(result.value).toBe(0)
  })

  it('continues to next platform when one platform service errors', async () => {
    const multiPlatformCampaign: CampaignSignalConfig = { ...campaign, platforms: ['bluesky', 'mastodon'] }
    mockBluesky.mockResolvedValue(err(new ExternalApiError('bluesky', 'API down')))
    mockMastodon.mockResolvedValue(ok([
      {
        id: '999', url: 'https://mastodon.social/@x/999', content: '<p>test</p>',
        plainText: 'test', author: 'x@mastodon.social', authorUrl: 'https://mastodon.social/@x',
        createdAt: '2026-01-01T00:00:00Z', repliesCount: 0, reblogsCount: 0, favouritesCount: 0,
      },
    ]))

    const result = await pollPlatformsForCampaign(mockRedis, multiPlatformCampaign, env)

    expect(result.isOk()).toBe(true)
    // Mastodon post gets queued even though Bluesky failed
    expect(mockQueueSend).toHaveBeenCalledTimes(1)
    if (result.isOk()) expect(result.value).toBe(1)
  })

  it('returns 0 when campaign has no platforms', async () => {
    const noPlatformCampaign: CampaignSignalConfig = { ...campaign, platforms: [] }

    const result = await pollPlatformsForCampaign(mockRedis, noPlatformCampaign, env)

    expect(result.isOk()).toBe(true)
    expect(mockQueueSend).not.toHaveBeenCalled()
    if (result.isOk()) expect(result.value).toBe(0)
  })
})
