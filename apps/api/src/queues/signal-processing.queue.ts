import { createDb } from '@/db'
import * as leadService from '@/services/lead.service'
import { logger } from '@/lib/logger'

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
 * Sprint 2: Creates a basic lead record with stub classification.
 * Sprint 4: Will add intent classification before lead creation.
 */
export async function handleSignalQueue(
  batch: MessageBatch<SignalProcessingMessage>,
  env: {
    DATABASE_URL: string
  },
): Promise<void> {
  const db = createDb(env.DATABASE_URL)

  for (const message of batch.messages) {
    const signal = message.body
    logger.info(
      { rawSignalId: signal.rawSignalId, platform: signal.platform, campaignId: signal.campaignId },
      'Processing signal from queue',
    )

    const result = await leadService.createLeadFromSignal(db, signal)

    if (result.isErr()) {
      logger.error(
        { err: result.error, rawSignalId: signal.rawSignalId },
        'Failed to create lead from signal — retrying',
      )
      message.retry()
      continue
    }

    message.ack()
    logger.info(
      { leadId: result.value.id, rawSignalId: signal.rawSignalId },
      'Signal processed — lead created',
    )
  }
}
