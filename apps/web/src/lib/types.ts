// ── Enums ──────────────────────────────────────────────────────────────────────

export type IntentType =
  | 'BUYING_INTENT'
  | 'PAIN_SIGNAL'
  | 'COMPARISON_INTENT'
  | 'HIRING_INTENT'
  | 'ANNOUNCEMENT_INTENT'

export type ScoreTier = 'HOT' | 'WARM' | 'COOL' | 'WEAK' | 'DISCARD'
export type LeadStatus = 'pending' | 'approved' | 'discarded' | 'pushed_crm'
export type EmailStatus = 'VALID' | 'INVALID' | 'RISKY' | 'UNKNOWN'
export type CampaignStatus = 'active' | 'paused' | 'archived'

// ── Lead ──────────────────────────────────────────────────────────────────────

export interface Lead {
  id: string
  campaignId: string
  userId: string
  platform: string
  postUrl: string
  postText: string
  postPublishedAt: string
  postEngagement: number
  intentType: IntentType
  intentConfidence: string   // decimal as string from Drizzle
  intentJustification: string
  urgencyScore: string
  personaMatchScore: string
  name: string | null
  username: string
  platformProfileUrl: string
  jobTitle: string | null
  company: string | null
  companyDomain: string | null
  location: string | null
  industry: string | null
  companySize: string | null
  email: string | null
  emailStatus: EmailStatus | null
  emailProvider: string | null
  phone: string | null
  linkedinUrl: string | null
  leadScore: number
  scoreTier: ScoreTier
  status: LeadStatus
  complianceGdprSafe: boolean
  complianceDpdpSafe: boolean
  enrichedAt: string | null
  createdAt: string
}

export interface LeadFilters {
  page?: number | undefined
  limit?: number | undefined
  campaignId?: string | undefined
  platform?: string | undefined
  status?: LeadStatus | undefined
  intentType?: IntentType | undefined
  scoreTier?: ScoreTier | undefined
}

// ── Campaign ──────────────────────────────────────────────────────────────────

export interface Campaign {
  id: string
  userId: string
  name: string
  keywords: string[]
  exclusionKeywords: string[]
  intentFilters: string[]
  platforms: string[]
  subredditTargets: string[]
  language: string
  minEngagement: number
  personaFilter: string | null
  geoFilter: string[]
  notificationFreq: 'realtime' | 'hourly' | 'daily'
  status: CampaignStatus
  createdAt: string
  updatedAt: string
}

export interface CreateCampaignInput {
  name: string
  keywords: string[]
  exclusionKeywords: string[]
  intentFilters: IntentType[]
  platforms: string[]
  subredditTargets: string[]
  language: string
  minEngagement: number
  personaFilter?: string
  geoFilter: string[]
  notificationFreq: 'realtime' | 'hourly' | 'daily'
}

// ── API responses ─────────────────────────────────────────────────────────────

export interface PageMeta {
  page: number
  limit: number
  total: number
  hasMore: boolean
}

export interface ApiSuccess<T> {
  success: true
  data: T
  meta?: PageMeta
}
