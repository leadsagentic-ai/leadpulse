import ky from 'ky'
import { ok, err, type Result } from 'neverthrow'
import { eq } from 'drizzle-orm'
import { type Database } from '@/db'
import { leads, enrichmentLog, type Lead } from '@/db/schema'
import { findEmailByDomain } from './hunter.service'
import { searchApolloPerson } from './apollo.service'
import { enrichPersonPdl } from './pdl.service'
import { scrapeLinkedInProfile } from './proxycurl.service'
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
 * Enrichment waterfall for a single lead (Phase 2):
 * 1. ML NER   → extract name / company / location / jobTitle
 * 2. Apollo   → person search (email + phone + linkedinUrl + industry + companySize)
 * 3. PDL      → fallback if Apollo found no email
 * 4. Hunter   → domain-only fallback if Apollo + PDL both missed
 * 5. Proxycurl → LinkedIn scrape if any step surfaced a LinkedIn URL
 * 6. Score    → score the fully-enriched lead
 * 4. Persist all enriched fields + enrichedAt to the DB
 */
export async function enrichLead(
  db: Database,
  lead: Lead,
  env: {
    ML_SERVICE_URL:    string
    ML_SERVICE_SECRET: string
    HUNTER_API_KEY?:   string
    APOLLO_API_KEY?:   string
    PDL_API_KEY?:      string
    PROXYCURL_API_KEY?: string
  },
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

  // ── Step 2: Apollo.io person search ─────────────────────────────────────
  const contactUpdates: {
    email?:         string
    emailStatus?:   'VALID' | 'INVALID' | 'RISKY' | 'UNKNOWN'
    emailProvider?: string
    phone?:         string
    phoneStatus?:   'VALID' | 'INVALID' | 'UNVERIFIED'
    linkedinUrl?:   string
    industry?:      string
    companySize?:   string
  } = {}

  const apolloStart = Date.now()
  const apolloResult = await searchApolloPerson(
    nerUpdates.name ?? lead.name ?? '',
    nerUpdates.company ?? lead.company,
    lead.companyDomain,
    env.APOLLO_API_KEY,
  )

  if (apolloResult.isOk() && apolloResult.value.found) {
    const a = apolloResult.value
    if (a.email)       { contactUpdates.email = a.email; contactUpdates.emailStatus = 'VALID'; contactUpdates.emailProvider = 'apollo.io' }
    if (a.phone)       { contactUpdates.phone = a.phone; contactUpdates.phoneStatus = 'UNVERIFIED' }
    if (a.linkedinUrl) { contactUpdates.linkedinUrl = a.linkedinUrl }
    if (a.industry)    { contactUpdates.industry    = a.industry }
    if (a.companySize) { contactUpdates.companySize = a.companySize }

    await db.insert(enrichmentLog).values({
      leadId:         lead.id,
      provider:       'apollo.io',
      dataType:       'contact',
      status:         'success',
      responseTimeMs: Date.now() - apolloStart,
      costInr:        '5.00',
    })
  } else {
    await db.insert(enrichmentLog).values({
      leadId:         lead.id,
      provider:       'apollo.io',
      dataType:       'contact',
      status:         apolloResult.isErr() ? 'error' : 'not_found',
      responseTimeMs: Date.now() - apolloStart,
    }).catch(() => undefined)
  }

  // ── Step 3: PDL — fallback if Apollo didn't find an email ────────────────
  if (!contactUpdates.email) {
    const pdlStart = Date.now()
    const pdlResult = await enrichPersonPdl(
      nerUpdates.name ?? lead.name ?? '',
      nerUpdates.company ?? lead.company,
      lead.companyDomain,
      env.PDL_API_KEY,
    )

    if (pdlResult.isOk() && pdlResult.value.found) {
      const p = pdlResult.value
      if (p.email)       { contactUpdates.email = p.email; contactUpdates.emailStatus = 'VALID'; contactUpdates.emailProvider = 'pdl' }
      if (p.phone && !contactUpdates.phone)              { contactUpdates.phone = p.phone; contactUpdates.phoneStatus = 'UNVERIFIED' }
      if (p.linkedinUrl && !contactUpdates.linkedinUrl)  { contactUpdates.linkedinUrl = p.linkedinUrl }
      if (p.industry    && !contactUpdates.industry)     { contactUpdates.industry    = p.industry }
      if (p.jobTitle    && !nerUpdates.jobTitle)         { nerUpdates.jobTitle        = p.jobTitle }

      await db.insert(enrichmentLog).values({
        leadId:         lead.id,
        provider:       'pdl',
        dataType:       'contact',
        status:         'success',
        responseTimeMs: Date.now() - pdlStart,
        costInr:        '3.00',
      })
    } else {
      await db.insert(enrichmentLog).values({
        leadId:         lead.id,
        provider:       'pdl',
        dataType:       'contact',
        status:         pdlResult.isErr() ? 'error' : 'not_found',
        responseTimeMs: Date.now() - pdlStart,
      }).catch(() => undefined)
    }
  }

  // ── Step 4: Hunter.io — domain fallback if Apollo + PDL both missed ──────
  if (!contactUpdates.email) {
    if (!lead.companyDomain) {
      logger.info({ leadId: lead.id }, 'No company domain — skipping Hunter fallback')
      await db.insert(enrichmentLog).values({
        leadId:   lead.id,
        provider: 'hunter.io',
        dataType: 'email',
        status:   'skipped',
      })
    } else {
      const hunterStart = Date.now()
      const hunterResult = await findEmailByDomain(lead.companyDomain, env.HUNTER_API_KEY)
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
        contactUpdates.email         = hunterResult.value.email
        contactUpdates.emailStatus   = 'VALID'
        contactUpdates.emailProvider = 'hunter.io'
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
  }

  // ── Step 5: Proxycurl — LinkedIn scrape if URL is now available ──────────
  const linkedinUrl = contactUpdates.linkedinUrl ?? lead.linkedinUrl
  if (linkedinUrl) {
    const proxycurlStart = Date.now()
    const proxycurlResult = await scrapeLinkedInProfile(linkedinUrl, env.PROXYCURL_API_KEY)

    if (proxycurlResult.isOk() && proxycurlResult.value.found) {
      const lx = proxycurlResult.value
      // LinkedIn data only fills gaps — don't overwrite already-enriched fields
      if (lx.name     && !nerUpdates.name)             { nerUpdates.name     = lx.name }
      if (lx.jobTitle && !nerUpdates.jobTitle)          { nerUpdates.jobTitle = lx.jobTitle }
      if (lx.company  && !nerUpdates.company)           { nerUpdates.company  = lx.company }
      if (lx.industry && !contactUpdates.industry)      { contactUpdates.industry = lx.industry }
      if (lx.location && !nerUpdates.location)          { nerUpdates.location = lx.location }

      await db.insert(enrichmentLog).values({
        leadId:         lead.id,
        provider:       'proxycurl',
        dataType:       'profile',
        status:         'success',
        responseTimeMs: Date.now() - proxycurlStart,
        costInr:        '8.00',
      })
    } else {
      await db.insert(enrichmentLog).values({
        leadId:         lead.id,
        provider:       'proxycurl',
        dataType:       'profile',
        status:         proxycurlResult.isErr() ? 'error' : 'not_found',
        responseTimeMs: Date.now() - proxycurlStart,
      }).catch(() => undefined)
    }
  }

  // ── Step 6: Score the (now-enriched) lead ─────────────────────────────────
  const enrichedSnapshot = { ...lead, ...nerUpdates, ...contactUpdates }

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

  // ── Step 7: Persist all updates ───────────────────────────────────────────
  try {
    const [updated] = await db
      .update(leads)
      .set({
        ...nerUpdates,
        ...contactUpdates,
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
