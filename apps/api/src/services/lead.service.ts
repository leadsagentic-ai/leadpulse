import { eq, and, desc, count } from 'drizzle-orm'
import { ok, err, type Result } from 'neverthrow'
import { leads } from '@/db/schema/leads.schema'
import type { Lead, NewLead } from '@/db/schema/leads.schema'
import type { Database } from '@/db'
import type { SignalProcessingMessage } from '@/queues/signal-processing.queue'
import { AppError, NotFoundError, ForbiddenError } from '@/lib/errors'
import { logger } from '@/lib/logger'

export interface LeadListFilters {
  page: number
  limit: number
  campaignId?: string
  platform?: string
  status?: 'pending' | 'approved' | 'discarded' | 'pushed_crm'
}

/**
 * Creates a lead record from a raw signal queued by the poller.
 * Sprint 2: intent fields are stubs — Sprint 4 will add real classification.
 */
export async function createLeadFromSignal(
  db: Database,
  signal: SignalProcessingMessage,
): Promise<Result<Lead, AppError>> {
  logger.info(
    { campaignId: signal.campaignId, platform: signal.platform, author: signal.authorUsername },
    'Creating lead from signal',
  )

  const newLead: NewLead = {
    campaignId:         signal.campaignId,
    userId:             signal.userId,
    platform:           signal.platform,
    postUrl:            signal.postUrl,
    postText:           signal.postText,
    postPublishedAt:    new Date(signal.postPublishedAt),
    postEngagement:     signal.postEngagement,
    username:           signal.authorUsername,
    platformProfileUrl: signal.platformProfileUrl,
    // Stub classification — will be updated by Sprint 4 intent classifier
    intentType:           'BUYING_INTENT',
    intentConfidence:     '0.000',
    intentJustification:  'Pending classification',
    urgencyScore:         '0.000',
    personaMatchScore:    '0.000',
    // Default score — updated by Sprint 5 scorer
    leadScore:  0,
    scoreTier:  'WEAK',
    status:     'pending',
  }

  const [created] = await db.insert(leads).values(newLead).returning()

  if (!created) {
    return err(new AppError('INTERNAL_ERROR', 'Failed to create lead record', 500))
  }

  logger.info({ leadId: created.id, campaignId: signal.campaignId }, 'Lead created from signal')
  return ok(created)
}

export async function getLeadById(
  db: Database,
  userId: string,
  id: string,
): Promise<Result<Lead, AppError>> {
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, id))
    .limit(1)

  if (!lead) {
    return err(new NotFoundError('Lead'))
  }

  if (lead.userId !== userId) {
    return err(new ForbiddenError())
  }

  return ok(lead)
}

export async function listLeads(
  db: Database,
  userId: string,
  filters: LeadListFilters,
): Promise<Result<{ leads: Lead[]; total: number }, AppError>> {
  const { page, limit, campaignId, platform, status } = filters
  const offset = (page - 1) * limit

  const conditions = [eq(leads.userId, userId)]
  if (campaignId)        conditions.push(eq(leads.campaignId, campaignId))
  if (platform)          conditions.push(eq(leads.platform, platform))
  if (status !== undefined) conditions.push(eq(leads.status, status))

  const where = and(...conditions)

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(leads)
      .where(where)
      .orderBy(desc(leads.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(leads)
      .where(where),
  ])

  return ok({ leads: rows, total: countRows[0]?.value ?? 0 })
}

export async function patchLeadStatus(
  db: Database,
  userId: string,
  id: string,
  status: 'approved' | 'discarded' | 'pushed_crm',
): Promise<Result<Lead, AppError>> {
  const existsResult = await getLeadById(db, userId, id)
  if (existsResult.isErr()) return existsResult

  const [updated] = await db
    .update(leads)
    .set({ status })
    .where(and(eq(leads.id, id), eq(leads.userId, userId)))
    .returning()

  if (!updated) {
    return err(new AppError('INTERNAL_ERROR', 'Failed to update lead status', 500))
  }

  logger.info({ leadId: id, status }, 'Lead status updated')
  return ok(updated)
}
