import { z } from 'zod'
import { PlatformEnum, IntentTypeEnum } from './lead'

export const CampaignStatusEnum      = z.enum(['active', 'paused', 'archived'])
export const NotificationFreqEnum    = z.enum(['realtime', 'hourly', 'daily'])

export const CampaignSchema = z.object({
  id:                z.string().uuid(),
  userId:            z.string(),
  name:              z.string().min(1).max(255),
  keywords:          z.array(z.string().min(1)).min(1).max(20),
  exclusionKeywords: z.array(z.string()).default([]),
  intentFilters:     z.array(IntentTypeEnum).default([]),
  platforms:         z.array(PlatformEnum).min(1),
  subredditTargets:  z.array(z.string()).default([]),
  language:          z.string().length(2).default('en'),
  minEngagement:     z.number().int().nonnegative().default(0),
  personaFilter:     z.string().max(500).nullable(),
  geoFilter:         z.array(z.string().length(2)).default([]),
  notificationFreq:  NotificationFreqEnum.default('daily'),
  status:            CampaignStatusEnum.default('active'),
  createdAt:         z.string().datetime(),
  updatedAt:         z.string().datetime(),
})

export const CreateCampaignSchema = CampaignSchema.omit({
  id: true, userId: true, createdAt: true, updatedAt: true,
})

export type CampaignStatus   = z.infer<typeof CampaignStatusEnum>
export type NotificationFreq = z.infer<typeof NotificationFreqEnum>
export type Campaign         = z.infer<typeof CampaignSchema>
export type CreateCampaign   = z.infer<typeof CreateCampaignSchema>
