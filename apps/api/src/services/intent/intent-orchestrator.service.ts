import ky, { HTTPError, TimeoutError } from 'ky'
import { ok, err, type Result } from 'neverthrow'
import { AppError, ExternalApiError } from '@/lib/errors'
import { logger } from '@/lib/logger'

// ── Contracts ──────────────────────────────────────────────────

export type IntentType =
  | 'BUYING_INTENT'
  | 'PAIN_SIGNAL'
  | 'COMPARISON_INTENT'
  | 'HIRING_INTENT'
  | 'ANNOUNCEMENT_INTENT'

export type Sentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'

export interface IntentResult {
  intentType:    IntentType
  confidence:    number   // 0.0–1.0
  urgencyScore:  number   // 0.0–1.0
  justification: string
  sentiment:     Sentiment
}

interface MlClassifyRequest {
  post_text:      string
  author_bio?:    string | null
  persona_filter?: string | null
  platform:       string
}

interface MlClassifyResponse {
  intent_type:   IntentType
  confidence:    number
  urgency_score: number
  justification: string
  sentiment:     Sentiment
}

// ── Service ────────────────────────────────────────────────────

/**
 * Calls the ML service to classify post intent.
 *
 * - Timeout: 30 s (Claude Haiku is fast, but we give margin for cold starts)
 * - Returns err() on network failure, timeout, or non-2xx response so the
 *   queue consumer can decide whether to retry or discard.
 */
export async function classifyIntent(
  postText:      string,
  authorBio:     string | null,
  personaFilter: string | null,
  platform:      string,
  env: { ML_SERVICE_URL: string; ML_SERVICE_SECRET: string },
): Promise<Result<IntentResult, AppError>> {
  const payload: MlClassifyRequest = {
    post_text:      postText,
    author_bio:     authorBio,
    persona_filter: personaFilter,
    platform,
  }

  try {
    const data = await ky
      .post(`${env.ML_SERVICE_URL}/classify`, {
        json:             payload,
        headers:          { Authorization: `Bearer ${env.ML_SERVICE_SECRET}` },
        timeout:          30_000,
        throwHttpErrors:  true,
        retry:            0,   // queue consumer owns retry logic
      })
      .json<MlClassifyResponse>()

    return ok({
      intentType:    data.intent_type,
      confidence:    data.confidence,
      urgencyScore:  data.urgency_score,
      justification: data.justification,
      sentiment:     data.sentiment,
    })
  } catch (e) {
    if (e instanceof TimeoutError) {
      logger.warn({ platform, postTextLength: postText.length }, 'ML service timeout')
      return err(new ExternalApiError('ml-service', 'Request timed out after 30 s'))
    }

    if (e instanceof HTTPError) {
      const status = e.response.status
      logger.warn({ status, platform }, 'ML service returned error status')
      return err(new ExternalApiError('ml-service', `HTTP ${status}`))
    }

    logger.error({ err: e, platform }, 'ML service unexpected error')
    return err(new ExternalApiError('ml-service', 'Unexpected error'))
  }
}
