import { Redis } from '@upstash/redis/cloudflare'
import { ok, err, type Result } from 'neverthrow'
import { logger } from '@/lib/logger'
import { AppError } from '@/lib/errors'
import { getRedditAccessToken, searchRedditPosts } from './reddit.service'
import { searchBlueskyPosts } from './bluesky.service'
import { searchThreadsPosts } from './threads.service'
import { searchMastodonPosts } from './mastodon.service'
import { isDuplicate, markAsSeen } from '@/services/deduplication.service'
import type { SignalProcessingMessage } from '@/queues/signal-processing.queue'

// ── Types ──────────────────────────────────────────────────────

export interface CampaignSignalConfig {
  id:               string
  userId:           string
  keywords:         string[]
  platforms:        string[]
  subredditTargets: string[]
}

export interface OrchestratorEnv {
  UPSTASH_REDIS_REST_URL:   string
  UPSTASH_REDIS_REST_TOKEN: string
  REDDIT_CLIENT_ID:         string
  REDDIT_CLIENT_SECRET:     string
  REDDIT_USER_AGENT:        string
  THREADS_ACCESS_TOKEN:     string
  SIGNAL_QUEUE: Queue<SignalProcessingMessage>
}

// ── Platform helpers ───────────────────────────────────────────

async function pollReddit(
  redis: Redis,
  campaign: CampaignSignalConfig,
  env: OrchestratorEnv,
): Promise<number> {
  const tokenResult = await getRedditAccessToken(
    env.REDDIT_CLIENT_ID,
    env.REDDIT_CLIENT_SECRET,
    env.REDDIT_USER_AGENT,
  )
  if (tokenResult.isErr()) {
    logger.warn(
      { err: tokenResult.error, campaignId: campaign.id },
      'Failed to get Reddit token — skipping Reddit for this campaign',
    )
    return 0
  }

  let queued = 0
  for (const keyword of campaign.keywords) {
    const result = await searchRedditPosts(
      keyword,
      campaign.subredditTargets,
      tokenResult.value,
      env.REDDIT_USER_AGENT,
      25,
      { upstashRedisRestUrl: env.UPSTASH_REDIS_REST_URL, upstashRedisRestToken: env.UPSTASH_REDIS_REST_TOKEN },
    )
    if (result.isErr()) {
      logger.warn({ err: result.error, campaignId: campaign.id, keyword }, 'Reddit search failed — skipping keyword')
      continue
    }
    for (const post of result.value) {
      const url = `https://reddit.com${post.permalink}`
      if (await isDuplicate(redis, url)) continue
      await markAsSeen(redis, url)
      const msg: SignalProcessingMessage = {
        rawSignalId:        post.id,
        campaignId:         campaign.id,
        userId:             campaign.userId,
        platform:           'reddit',
        postTitle:          post.title,
        postText:           `${post.title}\n\n${post.selftext}`.trim(),
        postUrl:            url,
        authorUsername:     post.author,
        platformProfileUrl: `https://www.reddit.com/u/${post.author}`,
        postPublishedAt:    new Date(post.created_utc * 1000).toISOString(),
        postEngagement:     post.score + post.num_comments,
      }
      await env.SIGNAL_QUEUE.send(msg)
      queued++
    }
  }
  return queued
}

async function pollBluesky(
  redis: Redis,
  campaign: CampaignSignalConfig,
  env: OrchestratorEnv,
): Promise<number> {
  let queued = 0
  for (const keyword of campaign.keywords) {
    const result = await searchBlueskyPosts(keyword, 25)
    if (result.isErr()) {
      logger.warn({ err: result.error, campaignId: campaign.id, keyword }, 'Bluesky search failed — skipping keyword')
      continue
    }
    for (const post of result.value) {
      if (await isDuplicate(redis, post.url)) continue
      await markAsSeen(redis, post.url)
      const msg: SignalProcessingMessage = {
        rawSignalId:        post.cid,
        campaignId:         campaign.id,
        userId:             campaign.userId,
        platform:           'bluesky',
        postTitle:          post.text.slice(0, 100),
        postText:           post.text,
        postUrl:            post.url,
        authorUsername:     post.author,
        platformProfileUrl: `https://bsky.app/profile/${post.author}`,
        postPublishedAt:    post.createdAt,
        postEngagement:     post.likeCount + post.repostCount + post.replyCount,
      }
      await env.SIGNAL_QUEUE.send(msg)
      queued++
    }
  }
  return queued
}

async function pollThreads(
  redis: Redis,
  campaign: CampaignSignalConfig,
  env: OrchestratorEnv,
): Promise<number> {
  if (!env.THREADS_ACCESS_TOKEN) {
    logger.warn({ campaignId: campaign.id }, 'No THREADS_ACCESS_TOKEN — skipping Threads')
    return 0
  }
  let queued = 0
  for (const keyword of campaign.keywords) {
    const result = await searchThreadsPosts(keyword, env.THREADS_ACCESS_TOKEN, 25)
    if (result.isErr()) {
      logger.warn({ err: result.error, campaignId: campaign.id, keyword }, 'Threads search failed — skipping keyword')
      continue
    }
    for (const post of result.value) {
      if (await isDuplicate(redis, post.url)) continue
      await markAsSeen(redis, post.url)
      const msg: SignalProcessingMessage = {
        rawSignalId:        post.id,
        campaignId:         campaign.id,
        userId:             campaign.userId,
        platform:           'threads',
        postTitle:          post.text.slice(0, 100),
        postText:           post.text,
        postUrl:            post.url,
        authorUsername:     post.username,
        platformProfileUrl: `https://www.threads.net/@${post.username}`,
        postPublishedAt:    post.createdAt,
        postEngagement:     post.likeCount + post.replyCount,
      }
      await env.SIGNAL_QUEUE.send(msg)
      queued++
    }
  }
  return queued
}

async function pollMastodon(
  redis: Redis,
  campaign: CampaignSignalConfig,
  env: OrchestratorEnv,
): Promise<number> {
  let queued = 0
  for (const keyword of campaign.keywords) {
    const result = await searchMastodonPosts(keyword, 'https://mastodon.social', 25)
    if (result.isErr()) {
      logger.warn({ err: result.error, campaignId: campaign.id, keyword }, 'Mastodon search failed — skipping keyword')
      continue
    }
    for (const status of result.value) {
      if (await isDuplicate(redis, status.url)) continue
      await markAsSeen(redis, status.url)
      const msg: SignalProcessingMessage = {
        rawSignalId:        status.id,
        campaignId:         campaign.id,
        userId:             campaign.userId,
        platform:           'mastodon',
        postTitle:          status.plainText.slice(0, 100),
        postText:           status.plainText,
        postUrl:            status.url,
        authorUsername:     status.author,
        platformProfileUrl: status.authorUrl,
        postPublishedAt:    status.createdAt,
        postEngagement:     status.repliesCount + status.reblogsCount + status.favouritesCount,
      }
      await env.SIGNAL_QUEUE.send(msg)
      queued++
    }
  }
  return queued
}

// ── Orchestrator ───────────────────────────────────────────────

/**
 * Polls all configured platforms for a single campaign.
 * Called by the scheduled signal poller for each active campaign.
 * Deduplicates results via Redis before enqueuing to SIGNAL_QUEUE.
 *
 * Returns the total number of new signals enqueued.
 */
export async function pollPlatformsForCampaign(
  redis: Redis,
  campaign: CampaignSignalConfig,
  env: OrchestratorEnv,
): Promise<Result<number, AppError>> {
  const { platforms } = campaign
  logger.info(
    { campaignId: campaign.id, platforms },
    'Polling platforms for campaign',
  )

  const results = await Promise.allSettled([
    platforms.includes('reddit')   ? pollReddit(redis, campaign, env)   : Promise.resolve(0),
    platforms.includes('bluesky')  ? pollBluesky(redis, campaign, env)  : Promise.resolve(0),
    platforms.includes('threads')  ? pollThreads(redis, campaign, env)  : Promise.resolve(0),
    platforms.includes('mastodon') ? pollMastodon(redis, campaign, env) : Promise.resolve(0),
  ])

  const totalQueued = results.reduce((sum, r) => {
    if (r.status === 'fulfilled') return sum + r.value
    logger.error({ err: r.reason, campaignId: campaign.id }, 'Platform poll threw unexpectedly')
    return sum
  }, 0)

  logger.info({ campaignId: campaign.id, totalQueued }, 'Platform poll complete for campaign')
  return ok(totalQueued)
}
