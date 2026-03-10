import ky from 'ky'
import { ok, err, type Result } from 'neverthrow'
import { eq } from 'drizzle-orm'
import { type Database } from '@/db'
import { leads, enrichmentLog, type Lead } from '@/db/schema'
import { findEmailByDomain } from './hunter.service'
import {
  calculateLeadScore,
  getScoreTier,
  type LeadScoreInput,
} from '@/services/scoring/lead-scorer.service'
import { logger } from '@/lib/logger'
import { toAppError, type AppError } from '@/lib/errors'

// ── Contracts ──────────────────────────────────────────────────────────────────

interface NerResponse {
  name:      string | null
  company:   string | null
  location:  string | null
  job_title: string | null
}

// ── Service ────────────────────────────────────────────────────────────────────

/**
 * Enrichment waterfall for a single lead:
 * 1. Call ML /extract-entities → populate name / company / location / jobTitle
 * 2. If companyDomain exists → call Hunter.io for email
 * 3. Calculate lead score across 5 dimensions
 * 4. Persist all enriched fields + enrichedAt to the DB
 */
export async function enrichLead(
  db: Database,
  lead: Lead,
  env: { ML_SERVICE_URL: string; ML_SERVICE_SECRET: string },
): Promise<Result<Lead, AppError>> {
  // ── Step 1: NER entity extraction ─────────────────────────────────────────
  let nerData: NerResponse = { name: null, company: null, location: null, job_title: null }
  const nerStart = Date.now()

  try {
    nerData = await ky
      .post(`${env.ML_SERVICE_URL}/extract-entities`, {
        json:    { post_text: lead.postText, author_bio: null },
        headers: { Authorization: `Bearer ${env.ML_SERVICE_SECRET}` },
        timeout: 15_000,
        retry:   0,
      })
      .json<NerResponse>()

    await db.insert(enrichmentLog).values({
      leadId:         lead.id,
      provider:       'ml-ner',
      dataType:       'identity',
      status:         'success',
      responseTimeMs: Date.now() - nerStart,
    })
  } catch (e) {
    logger.warn({ leadId: lead.id, err: e }, 'NER extraction failed — continuing without identity data')
    // Best-effort log; don't block enrichment if log write also fails
    await db.insert(enrichmentLog).values({
      leadId:         lead.id,
      provider:       'ml-ner',
      dataType:       'identity',
      status:         'error',
      responseTimeMs: Date.now() - nerStart,
    }).catch(() => undefined)
  }

  // Merge NER results — only override if NER found something
  const nerUpdates = {
    name:     nerData.name      ?? lead.name,
    company:  nerData.company   ?? lead.company,
    location: nerData.location  ?? lead.location,
    jobTitle: nerData.job_title ?? lead.jobTitle,
  }

  // ── Step 2: Hunter.io email enrichment ────────────────────────────────────
  const emailUpdates: {
    email?:         string
    emailStatus?:   'VALID' | 'INVALID' | 'RISKY' | 'UNKNOWN'
    emailProvider?: string
  } = {}

  if (!lead.companyDomain) {
    logger.info({ leadId: lead.id }, 'No company domain — skipping email enrichment')
    await db.insert(enrichmentLog).values({
      leadId:   lead.id,
      provider: 'hunter.io',
      dataType: 'email',
      status:   'skipped',
    })
  } else {
    const hunterStart = Date.now()
    const hunterResult = await findEmailByDomain(lead.companyDomain)
    const elapsedMs = Date.now() - hunterStart

    if (hunterResult.isErr()) {
      logger.warn({ leadId: lead.id, code: hunterResult.error.code }, 'Hunter.io enrichment error')
      await db.insert(enrichmentLog).values({
        leadId:         lead.id,
        provider:       'hunter.io',
        dataType:       'email',
        status:         'error',
        responseTimeMs: elapsedMs,
      })
    } else if (!hunterResult.value.found) {
      await db.insert(enrichmentLog).values({
        leadId:         lead.id,
        provider:       'hunter.io',
        dataType:       'email',
        status:         'not_found',
        responseTimeMs: elapsedMs,
        costInr:        '2.50',
      })
    } else {
      emailUpdates.email         = hunterResult.value.email
      emailUpdates.emailStatus   = 'VALID'
      emailUpdates.emailProvider = 'hunter.io'
      await db.insert(enrichmentLog).values({
        leadId:         lead.id,
        provider:       'hunter.io',
        dataType:       'email',
        status:         'success',
        responseTimeMs: elapsedMs,
        costInr:        '2.50',
      })
    }
  }

  // ── Step 3: Score the (now-enriched) lead ─────────────────────────────────
  const enrichedSnapshot = { ...lead, ...nerUpdates, ...emailUpdates }

  const scoreInput: LeadScoreInput = {
    intentType:       enrichedSnapshot.intentType,
    intentConfidence: Number(enrichedSnapshot.intentConfidence),
    urgencyScore:     Number(enrichedSnapshot.urgencyScore),
    email:            enrichedSnapshot.email,
    phone:            enrichedSnapshot.phone,
    linkedinUrl:      enrichedSnapshot.linkedinUrl,
    companyDomain:    enrichedSnapshot.companyDomain,
    name:             enrichedSnapshot.name,
    platform:         enrichedSnapshot.platform,
    postPublishedAt:  enrichedSnapshot.postPublishedAt,
    jobTitle:         enrichedSnapshot.jobTitle,
    company:          enrichedSnapshot.company,
    industry:         enrichedSnapshot.industry,
  }

  const leadScore = calculateLeadScore(scoreInput)
  const scoreTier = getScoreTier(leadScore)

  // ── Step 4: Persist all updates ───────────────────────────────────────────
  try {
    const [updated] = await db
      .update(leads)
      .set({
        ...nerUpdates,
        ...emailUpdates,
        leadScore,
        scoreTier,
        enrichedAt: new Date(),
      })
      .where(eq(leads.id, lead.id))
      .returning()

    logger.info({ leadId: lead.id, leadScore, scoreTier }, 'Lead enriched and scored')
    return ok(updated as Lead)
  } catch (e) {
    return err(toAppError(e))
  }
}
