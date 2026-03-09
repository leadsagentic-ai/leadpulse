import { z } from 'zod'

export const PlatformEnum = z.enum([
  'reddit',
  'bluesky',
  'linkedin',
  'threads',
  'mastodon',
  'github',
  'naukri',
  'x',
])

export const IntentTypeEnum = z.enum([
  'BUYING_INTENT',
  'PAIN_SIGNAL',
  'COMPARISON_INTENT',
  'HIRING_INTENT',
  'ANNOUNCEMENT_INTENT',
])

export const ScoreTierEnum = z.enum(['HOT', 'WARM', 'COOL', 'WEAK', 'DISCARD'])

export const LeadStatusEnum = z.enum([
  'new',
  'enriching',
  'enriched',
  'failed',
  'contacted',
  'converted',
  'disqualified',
])

export const LeadSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  campaignId: z.string().uuid().nullable(),
  platform: PlatformEnum,
  platformUserId: z.string(),
  platformUsername: z.string().nullable(),
  originalPostUrl: z.string().url(),
  originalPostTitle: z.string().nullable(),
  originalPostBody: z.string(),
  intentType: IntentTypeEnum,
  intentScore: z.number().int().min(0).max(100),
  intentRationale: z.string().nullable(),
  scoreTier: ScoreTierEnum,
  compositeScore: z.number().int().min(0).max(100),
  status: LeadStatusEnum,
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().email().nullable(),
  linkedinUrl: z.string().url().nullable(),
  jobTitle: z.string().nullable(),
  companyName: z.string().nullable(),
  companyDomain: z.string().nullable(),
  companySize: z.string().nullable(),
  industry: z.string().nullable(),
  location: z.string().nullable(),
  painPoints: z.array(z.string()),
  keywords: z.array(z.string()),
  techStack: z.array(z.string()),
  isVerified: z.boolean(),
  enrichedAt: z.string().datetime().nullable(),
  crmSyncedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const LeadFiltersSchema = z.object({
  campaignId: z.string().uuid().optional(),
  platform: PlatformEnum.optional(),
  intentType: IntentTypeEnum.optional(),
  scoreTier: ScoreTierEnum.optional(),
  status: LeadStatusEnum.optional(),
  isVerified: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(20),
})

export type Lead = z.infer<typeof LeadSchema>
export type LeadFilters = z.infer<typeof LeadFiltersSchema>
export type Platform = z.infer<typeof PlatformEnum>
export type IntentType = z.infer<typeof IntentTypeEnum>
export type ScoreTier = z.infer<typeof ScoreTierEnum>
export type LeadStatus = z.infer<typeof LeadStatusEnum>
