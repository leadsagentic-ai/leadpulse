import { eq } from 'drizzle-orm'
import { Redis } from '@upstash/redis/cloudflare'
import { createDb } from '@/db'
import { campaigns } from '@/db/schema/campaigns.schema'
import { users } from '@/db/schema/users.schema'
import { getRedditAccessToken, searchRedditPosts } from '@/services/signals/reddit.service'
import { isDuplicate, markAsSeen } from '@/services/deduplication.service'
import type { SignalProcessingMessage } from '@/queues/signal-processing.queue'
import { logger } from '@/lib/logger'

interface PollerEnv {
  DATABASE_URL: string
  UPSTASH_REDIS_REST_URL: string
  UPSTASH_REDIS_REST_TOKEN: string
  REDDIT_CLIENT_ID: string
  REDDIT_CLIENT_SECRET: string
  REDDIT_USER_AGENT: string
  SIGNAL_QUEUE: Queue<SignalProcessingMessage>
}

/**
 * Runs every 30 minutes via Cloudflare Workers `scheduled` trigger.
 * For each active campaign that includes Reddit as a platform:
 *   1. Fetches an OAuth token
 *   2. Searches Reddit for each keyword
 *   3. Deduplicates results via Redis
 *   4. Enqueues new posts to the signal-processing queue
 */
export async function runSignalPoller(
  scheduledEvent: ScheduledEvent,
  env: PollerEnv,
): Promise<void> {
  logger.info({ scheduledTime: scheduledEvent.scheduledTime }, 'Signal poller started')

  const db = createDb(env.DATABASE_URL)
  const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  })

  // Get all active campaigns that include Reddit
  const activeCampaigns = await db
    .select({
      id:               campaigns.id,
      userId:           campaigns.userId,
      keywords:         campaigns.keywords,
      platforms:        campaigns.platforms,
      subredditTargets: campaigns.subredditTargets,
    })
    .from(campaigns)
    .where(eq(campaigns.status, 'active'))

  const redditCampaigns = activeCampaigns.filter((c) => c.platforms.includes('reddit'))

  if (redditCampaigns.length === 0) {
    logger.info({}, 'No active Reddit campaigns — poller done')
    return
  }

  logger.info({ count: redditCampaigns.length }, 'Polling Reddit for active campaigns')

  // Get Reddit access token once — reuse for all campaigns this cycle
  const tokenResult = await getRedditAccessToken(
    env.REDDIT_CLIENT_ID,
    env.REDDIT_CLIENT_SECRET,
    env.REDDIT_USER_AGENT,
  )

  if (tokenResult.isErr()) {
    logger.error({ err: tokenResult.error }, 'Failed to get Reddit access token — aborting poll cycle')
    return
  }

  const accessToken = tokenResult.value

  // Get the workspace owner (userId) → platform profile URL helper
  // We pass userId directly from campaigns which already has userId
  let totalQueued = 0

  for (const campaign of redditCampaigns) {
    logger.info(
      { campaignId: campaign.id, keywords: campaign.keywords },
      'Polling Reddit for campaign',
    )

    // Search each keyword separately for better coverage
    for (const keyword of campaign.keywords) {
      const searchResult = await searchRedditPosts(
        keyword,
        campaign.subredditTargets,
        accessToken,
        env.REDDIT_USER_AGENT,
        25,
        {
          upstashRedisRestUrl:   env.UPSTASH_REDIS_REST_URL,
          upstashRedisRestToken: env.UPSTASH_REDIS_REST_TOKEN,
        },
      )

      if (searchResult.isErr()) {
        logger.warn(
          { err: searchResult.error, campaignId: campaign.id, keyword },
          'Reddit search failed for keyword — skipping',
        )
        continue
      }

      for (const post of searchResult.value) {
        const postUrl = `https://reddit.com${post.permalink}`

        // Skip already-seen posts
        if (await isDuplicate(redis, postUrl)) continue

        // Mark seen before queuing to avoid double-processing if queue is slow
        await markAsSeen(redis, postUrl)

        const message: SignalProcessingMessage = {
          rawSignalId:        post.id,
          campaignId:         campaign.id,
          userId:             campaign.userId,
          platform:           'reddit',
          postTitle:          post.title,
          postText:           `${post.title}\n\n${post.selftext}`.trim(),
          postUrl,
          authorUsername:     post.author,
          platformProfileUrl: `https://www.reddit.com/u/${post.author}`,
          postPublishedAt:    new Date(post.created_utc * 1000).toISOString(),
          postEngagement:     post.score + post.num_comments,
        }

        await env.SIGNAL_QUEUE.send(message)
        totalQueued++
      }
    }
  }

  logger.info({ totalQueued }, 'Signal poller completed')
}
