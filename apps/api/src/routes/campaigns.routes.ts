import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '@/middleware/auth.middleware'
import { rateLimitMiddleware } from '@/middleware/rate-limit.middleware'
import * as handler from '@/handlers/campaigns.handler'

const PlatformEnum = z.enum(['reddit', 'bluesky', 'threads', 'mastodon', 'github', 'linkedin', 'naukri', 'x'])
const IntentFilterEnum = z.enum([
  'BUYING_INTENT', 'PAIN_SIGNAL', 'COMPARISON_INTENT', 'HIRING_INTENT', 'ANNOUNCEMENT_INTENT',
])

const CreateCampaignSchema = z.object({
  name:              z.string().min(1).max(255),
  keywords:          z.array(z.string().min(1)).min(1).max(20),
  exclusionKeywords: z.array(z.string()).default([]),
  intentFilters:     z.array(IntentFilterEnum).default([]),
  platforms:         z.array(PlatformEnum).min(1),
  subredditTargets:  z.array(z.string()).default([]),
  language:          z.string().length(2).default('en'),
  minEngagement:     z.number().int().min(0).default(0),
  personaFilter:     z.string().max(500).optional(),
  geoFilter:         z.array(z.string().length(2)).default([]),
  notificationFreq:  z.enum(['realtime', 'hourly', 'daily']).default('daily'),
})

const PatchCampaignStatusSchema = z.object({
  status: z.enum(['active', 'paused']),
})

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>
export type PatchCampaignStatusInput = z.infer<typeof PatchCampaignStatusSchema>

type HonoEnv = {
  Bindings: {
    DATABASE_URL: string
    UPSTASH_REDIS_REST_URL: string
    UPSTASH_REDIS_REST_TOKEN: string
    FIREBASE_WEB_API_KEY: string
  }
  Variables: { userId: string; userEmail: string }
}

export const campaignRoutes = new Hono<HonoEnv>()
  .use('*', authMiddleware)
  .use('*', rateLimitMiddleware({ limit: 100, window: 60 }))
  .get('/',        handler.listCampaigns)
  .post('/',       zValidator('json', CreateCampaignSchema),      handler.createCampaign)
  .get('/:id',     handler.getCampaign)
  .put('/:id',     zValidator('json', CreateCampaignSchema),      handler.updateCampaign)
  .patch('/:id/status', zValidator('json', PatchCampaignStatusSchema), handler.patchCampaignStatus)
  .delete('/:id',  handler.deleteCampaign)
  .get('/:id/analytics', handler.getCampaignAnalytics)
