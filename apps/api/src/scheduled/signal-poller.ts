import { eq } from 'drizzle-orm'
import { Redis } from '@upstash/redis/cloudflare'
import { createDb } from '@/db'
import { campaigns } from '@/db/schema/campaigns.schema'
import { pollPlatformsForCampaign } from '@/services/signals/signal-orchestrator.service'
import type { OrchestratorEnv } from '@/services/signals/signal-orchestrator.service'
import { logger } from '@/lib/logger'

interface PollerEnv extends OrchestratorEnv {
  DATABASE_URL: string
}

/**
 * Runs every 30 minutes via Cloudflare Workers `scheduled` trigger.
 * Fetches all active campaigns and delegates to the signal orchestrator,
 * which dispatches to whichever platforms each campaign is configured for.
 */
export async function runSignalPoller(
  scheduledEvent: ScheduledEvent,
  env: PollerEnv,
): Promise<void> {
  logger.info({ scheduledTime: scheduledEvent.scheduledTime }, 'Signal poller started')

  const db = createDb(env.DATABASE_URL)
  const redis = new Redis({
    url:   env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  })

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

  if (activeCampaigns.length === 0) {
    logger.info({}, 'No active campaigns — poller done')
    return
  }

  logger.info({ count: activeCampaigns.length }, 'Polling platforms for active campaigns')

  let totalQueued = 0

  for (const campaign of activeCampaigns) {
    const result = await pollPlatformsForCampaign(redis, campaign, env)
    if (result.isOk()) {
      totalQueued += result.value
    } else {
      logger.error({ err: result.error, campaignId: campaign.id }, 'Orchestrator failed for campaign')
    }
  }

  logger.info({ totalQueued }, 'Signal poller completed')
}
