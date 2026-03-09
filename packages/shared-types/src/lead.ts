import { z } from 'zod'

export const PlatformEnum = z.enum([
  'reddit', 'bluesky', 'linkedin', 'threads', 'mastodon', 'github', 'naukri', 'x',
])

export const IntentTypeEnum = z.enum([
  'BUYING_INTENT', 'PAIN_SIGNAL', 'COMPARISON_INTENT', 'HIRING_INTENT', 'ANNOUNCEMENT_INTENT',
])

export const ScoreTierEnum = z.enum(['HOT', 'WARM', 'COOL', 'WEAK', 'DISCARD'])

export const EmailStatusEnum = z.enum(['VALID', 'INVALID', 'RISKY', 'UNKNOWN'])

export const PhoneStatusEnum = z.enum(['VALID', 'INVALID', 'UNVERIFIED'])

export const LeadStatusEnum = z.enum(['pending', 'approved', 'discarded', 'pushed_crm'])

export const LeadSchema = z.object({
  id:                    z.string().uuid(),
  campaignId:            z.string().uuid(),
  userId:                z.string(),

  // Platform
  platform:              PlatformEnum,
  postUrl:               z.string().url(),
  postText:              z.string(),
  postPublishedAt:       z.string().datetime(),
  postEngagement:        z.number().int().nonnegative(),

  // AI classification
  intentType:          IntentTypeEnum,
  intentConfidence:    z.number().min(0).max(1),
  intentJustification: z.string(),
  urgencyScore:        z.number().min(0).max(1),
  personaMatchScore:   z.number().min(0).max(1),

  // Identity
  name:               z.string().nullable(),
  username:           z.string(),
  platformProfileUrl: z.string().url(),
  jobTitle:           z.string().nullable(),
  company:            z.string().nullable(),
  companyDomain:      z.string().nullable(),
  location:           z.string().nullable(),
  industry:           z.string().nullable(),
  companySize:        z.string().nullable(),

  // Contact
  email:         z.string().email().nullable(),
  emailStatus:   EmailStatusEnum.nullable(),
  emailProvider: z.string().nullable(),
  phone:         z.string().nullable(),
  phoneStatus:   PhoneStatusEnum.nullable(),
  linkedinUrl:   z.string().url().nullable(),

  // Score
  leadScore: z.number().int().min(0).max(100),
  scoreTier: ScoreTierEnum,

  // Status
  status:       LeadStatusEnum,
  crmPushedAt:  z.string().datetime().nullable(),
  crmRecordUrl: z.string().url().nullable(),

  // Compliance
  complianceGdprSafe: z.boolean(),
  complianceDpdpSafe: z.boolean(),

  // Timestamps
  createdAt:  z.string().datetime(),
  enrichedAt: z.string().datetime().nullable(),
})

export const LeadFiltersSchema = z.object({
  page:        z.number().int().positive().default(1),
  limit:       z.number().int().min(1).max(100).default(20),
  platform:    PlatformEnum.optional(),
  intentType:  IntentTypeEnum.optional(),
  scoreTier:   ScoreTierEnum.optional(),
  minScore:    z.number().int().min(0).max(100).optional(),
  maxScore:    z.number().int().min(0).max(100).optional(),
  status:      LeadStatusEnum.optional(),
  campaignId:  z.string().uuid().optional(),
  emailStatus: EmailStatusEnum.optional(),
  dateFrom:    z.string().datetime().optional(),
  dateTo:      z.string().datetime().optional(),
})

export type Platform    = z.infer<typeof PlatformEnum>
export type IntentType  = z.infer<typeof IntentTypeEnum>
export type ScoreTier   = z.infer<typeof ScoreTierEnum>
export type EmailStatus = z.infer<typeof EmailStatusEnum>
export type PhoneStatus = z.infer<typeof PhoneStatusEnum>
export type LeadStatus  = z.infer<typeof LeadStatusEnum>
export type Lead        = z.infer<typeof LeadSchema>
export type LeadFilters = z.infer<typeof LeadFiltersSchema>
