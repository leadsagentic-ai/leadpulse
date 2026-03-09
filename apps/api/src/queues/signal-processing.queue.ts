import { createDb } from '@/db'
import * as leadService from '@/services/lead.service'
import { classifyIntent } from '@/services/intent/intent-orchestrator.service'
import { logger } from '@/lib/logger'

// Confidence threshold — posts scoring below this are too weak to create leads
const INTENT_CONFIDENCE_THRESHOLD = 0.6

// ── Message payload ────────────────────────────────────────────

export interface SignalProcessingMessage {
  rawSignalId: string      // Reddit post id (e.g. "abc123")
  campaignId: string
  userId: string
  platform: 'reddit' | 'bluesky' | 'threads' | 'mastodon'
  postText: string
  postTitle: string
  postUrl: string
  authorUsername: string
  platformProfileUrl: string
  postPublishedAt: string  // ISO 8601
  postEngagement: number
}

// ── Consumer ───────────────────────────────────────────────────

/**
 * Cloudflare Queue consumer — called automatically by the Workers runtime.
 * Sprint 4: classifies intent via the ML service before creating a lead.
 * - ML failure → retry message
 * - Confidence < 0.6 → discard (ack without creating a lead)
 * - Confidence ≥ 0.6 → create lead with real classification → enqueue enrichment
 */
export async function handleSignalQueue(
  batch: MessageBatch<SignalProcessingMessage>,
  env: {
    DATABASE_URL:    string
    ML_SERVICE_URL:  string
    ML_SERVICE_SECRET: string
    ENRICHMENT_QUEUE: Queue
  },
): Promise<void> {
  const db = createDb(env.DATABASE_URL)

  for (const message of batch.messages) {
    const signal = message.body
    logger.info(
      { rawSignalId: signal.rawSignalId, platform: signal.platform, campaignId: signal.campaignId },
      'Processing signal from queue',
    )

    // ── Step 1: classify intent ──────────────────────────────
    const intentResult = await classifyIntent(
      signal.postText,
      null,
      null,
      signal.platform,
      env,
    )

    if (intentResult.isErr()) {
      logger.error(
        { err: intentResult.error, rawSignalId: signal.rawSignalId },
        'ML classification failed — retrying signal',
      )
      message.retry()
      continue
    }

    const intent = intentResult.value

    // ── Step 2: discard low-confidence signals ───────────────
    if (intent.confidence < INTENT_CONFIDENCE_THRESHOLD) {
      logger.info(
        { rawSignalId: signal.rawSignalId, confidence: intent.confidence, intentType: intent.intentType },
        'Signal discarded — confidence below threshold',
      )
      message.ack()
      continue
    }

    // ── Step 3: create lead with real classification ─────────
    const leadResult = await leadService.createLeadFromSignal(db, signal, intent)

    if (leadResult.isErr()) {
      logger.error(
        { err: leadResult.error, rawSignalId: signal.rawSignalId },
        'Failed to create lead from signal — retrying',
      )
      message.retry()
      continue
    }

    const lead = leadResult.value

    // ── Step 4: enqueue enrichment ───────────────────────────
    await env.ENRICHMENT_QUEUE.send({ leadId: lead.id, userId: signal.userId })

    message.ack()
    logger.info(
      { leadId: lead.id, rawSignalId: signal.rawSignalId, intentType: intent.intentType, confidence: intent.confidence },
      'Signal processed — lead created and enrichment enqueued',
    )
  }
}
