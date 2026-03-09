import { z } from 'zod'
import { PlatformEnum } from './lead'

export const CampaignStatusEnum = z.enum([
  'draft',
  'active',
  'paused',
  'archived',
])

export const NotificationFrequencyEnum = z.enum([
  'realtime',
  'hourly',
  'daily',
  'weekly',
])

export const CampaignConfigSchema = z.object({
  subreddits: z.array(z.string()).optional(),
  blueskyHashtags: z.array(z.string()).optional(),
  linkedinKeywords: z.array(z.string()).optional(),
  githubTopics: z.array(z.string()).optional(),
  keywords: z.array(z.string()),
  excludeKeywords: z.array(z.string()).default([]),
  minScore: z.number().int().min(0).max(100).default(50),
  targetPlatforms: z.array(PlatformEnum),
  icp: z.object({
    jobTitles: z.array(z.string()).optional(),
    companySizes: z.array(z.string()).optional(),
    industries: z.array(z.string()).optional(),
    locations: z.array(z.string()).optional(),
  }).optional(),
})

export const CampaignSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  status: CampaignStatusEnum,
  config: CampaignConfigSchema,
  notificationFrequency: NotificationFrequencyEnum,
  dailyLeadLimit: z.number().int().positive().nullable(),
  totalLeadsFound: z.number().int().default(0),
  totalLeadsEnriched: z.number().int().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const CreateCampaignSchema = CampaignSchema.omit({
  id: true,
  workspaceId: true,
  totalLeadsFound: true,
  totalLeadsEnriched: true,
  createdAt: true,
  updatedAt: true,
})

export const UpdateCampaignSchema = CreateCampaignSchema.partial()

export type Campaign = z.infer<typeof CampaignSchema>
export type CampaignConfig = z.infer<typeof CampaignConfigSchema>
export type CampaignStatus = z.infer<typeof CampaignStatusEnum>
export type NotificationFrequency = z.infer<typeof NotificationFrequencyEnum>
export type CreateCampaign = z.infer<typeof CreateCampaignSchema>
export type UpdateCampaign = z.infer<typeof UpdateCampaignSchema>
