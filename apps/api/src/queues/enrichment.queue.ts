import { eq } from 'drizzle-orm'
import { createDb } from '@/db'
import { leads } from '@/db/schema'
import { enrichLead } from '@/services/enrichment/waterfall-orchestrator.service'
import { logger } from '@/lib/logger'

// ── Message payload ────────────────────────────────────────────────────────────

export interface EnrichmentMessage {
  leadId: string
  userId: string
}

// ── Consumer ───────────────────────────────────────────────────────────────────

/**
 * Cloudflare Queue consumer for `leadpulse-enrichment`.
 * For each message: fetch lead → call waterfall enrichment → ack or retry.
 */
export async function handleEnrichmentQueue(
  batch: MessageBatch<EnrichmentMessage>,
  env: {
    DATABASE_URL:       string
    ML_SERVICE_URL:     string
    ML_SERVICE_SECRET:  string
    HUNTER_API_KEY?:    string
    APOLLO_API_KEY?:    string
    PDL_API_KEY?:       string
    PROXYCURL_API_KEY?: string
  },
): Promise<void> {
  const db = createDb(env.DATABASE_URL)

  for (const message of batch.messages) {
    const { leadId, userId } = message.body
    logger.info({ leadId, userId }, 'Processing enrichment message')

    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1)

    if (!lead) {
      logger.warn({ leadId }, 'Lead not found — acknowledging without enrichment')
      message.ack()
      continue
    }

    const result = await enrichLead(db, lead, env)

    if (result.isErr()) {
      logger.error({ leadId, code: result.error.code }, 'Enrichment failed — scheduling retry')
      message.retry()
    } else {
      logger.info({ leadId, leadScore: result.value.leadScore, scoreTier: result.value.scoreTier }, 'Enrichment complete')
      message.ack()
    }
  }
}
