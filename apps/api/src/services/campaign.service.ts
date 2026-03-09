import { eq, and, desc, count, sql } from 'drizzle-orm'
import { ok, err, type Result } from 'neverthrow'
import { campaigns } from '@/db/schema/campaigns.schema'
import type { Campaign, NewCampaign } from '@/db/schema/campaigns.schema'
import type { Database } from '@/db'
import { NotFoundError, ForbiddenError, AppError } from '@/lib/errors'
import { logger } from '@/lib/logger'

export interface CreateCampaignInput {
  name: string
  keywords: string[]
  exclusionKeywords?: string[]
  intentFilters?: string[]
  platforms: string[]
  subredditTargets?: string[]
  language?: string
  minEngagement?: number
  personaFilter?: string
  geoFilter?: string[]
  notificationFreq?: 'realtime' | 'hourly' | 'daily'
}

export interface CampaignListResult {
  campaigns: Campaign[]
  total: number
  page: number
  limit: number
}

export interface CampaignListFilters {
  status?: 'active' | 'paused' | 'archived'
  page?: number
  limit?: number
}

export async function createCampaign(
  db: Database,
  userId: string,
  input: CreateCampaignInput,
): Promise<Result<Campaign, AppError>> {
  logger.info({ userId, name: input.name }, 'Creating campaign')

  const newCampaign: NewCampaign = {
    userId,
    name: input.name,
    keywords: input.keywords,
    exclusionKeywords: input.exclusionKeywords ?? [],
    intentFilters: input.intentFilters ?? [],
    platforms: input.platforms,
    subredditTargets: input.subredditTargets ?? [],
    language: input.language ?? 'en',
    minEngagement: input.minEngagement ?? 0,
    personaFilter: input.personaFilter ?? null,
    geoFilter: input.geoFilter ?? [],
    notificationFreq: input.notificationFreq ?? 'daily',
    status: 'active',
  }

  const [created] = await db.insert(campaigns).values(newCampaign).returning()

  if (!created) {
    return err(new AppError('INTERNAL_ERROR', 'Failed to create campaign', 500))
  }

  logger.info({ campaignId: created.id, userId }, 'Campaign created')
  return ok(created)
}

export async function listCampaigns(
  db: Database,
  userId: string,
  filters: CampaignListFilters = {},
): Promise<Result<CampaignListResult, AppError>> {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 20
  const offset = (page - 1) * limit

  const conditions = [eq(campaigns.userId, userId)]
  if (filters.status) {
    conditions.push(eq(campaigns.status, filters.status))
  }

  const whereClause = and(...conditions)

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(campaigns)
      .where(whereClause)
      .orderBy(desc(campaigns.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(campaigns).where(whereClause),
  ])

  const total = Number(countRows[0]?.value ?? 0)

  return ok({ campaigns: rows, total, page, limit })
}

export async function getCampaignById(
  db: Database,
  userId: string,
  id: string,
): Promise<Result<Campaign, AppError>> {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1)

  if (!campaign) {
    return err(new NotFoundError('Campaign'))
  }

  if (campaign.userId !== userId) {
    return err(new ForbiddenError())
  }

  return ok(campaign)
}

export async function updateCampaign(
  db: Database,
  userId: string,
  id: string,
  input: CreateCampaignInput,
): Promise<Result<Campaign, AppError>> {
  const existing = await getCampaignById(db, userId, id)
  if (existing.isErr()) return err(existing.error)

  const [updated] = await db
    .update(campaigns)
    .set({
      name: input.name,
      keywords: input.keywords,
      exclusionKeywords: input.exclusionKeywords ?? [],
      intentFilters: input.intentFilters ?? [],
      platforms: input.platforms,
      subredditTargets: input.subredditTargets ?? [],
      language: input.language ?? 'en',
      minEngagement: input.minEngagement ?? 0,
      personaFilter: input.personaFilter ?? null,
      geoFilter: input.geoFilter ?? [],
      notificationFreq: input.notificationFreq ?? 'daily',
      updatedAt: new Date(),
    })
    .where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)))
    .returning()

  if (!updated) {
    return err(new AppError('INTERNAL_ERROR', 'Failed to update campaign', 500))
  }

  logger.info({ campaignId: id, userId }, 'Campaign updated')
  return ok(updated)
}

export async function patchCampaignStatus(
  db: Database,
  userId: string,
  id: string,
  status: 'active' | 'paused',
): Promise<Result<Campaign, AppError>> {
  const existing = await getCampaignById(db, userId, id)
  if (existing.isErr()) return err(existing.error)

  const [updated] = await db
    .update(campaigns)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)))
    .returning()

  if (!updated) {
    return err(new AppError('INTERNAL_ERROR', 'Failed to update campaign status', 500))
  }

  logger.info({ campaignId: id, userId, status }, 'Campaign status updated')
  return ok(updated)
}

export async function deleteCampaign(
  db: Database,
  userId: string,
  id: string,
): Promise<Result<void, AppError>> {
  const existing = await getCampaignById(db, userId, id)
  if (existing.isErr()) return err(existing.error)

  // Soft delete — archive rather than hard delete
  await db
    .update(campaigns)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)))

  logger.info({ campaignId: id, userId }, 'Campaign archived (soft delete)')
  return ok(undefined)
}
