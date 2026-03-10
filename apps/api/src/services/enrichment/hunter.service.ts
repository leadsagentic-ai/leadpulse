import ky from 'ky'
import { ok, err, type Result } from 'neverthrow'
import { env } from '@/lib/env'
import { ExternalApiError, RateLimitedError, type AppError } from '@/lib/errors'
import { logger } from '@/lib/logger'

// ── Contracts ──────────────────────────────────────────────────

export interface HunterEmailResult {
  email:      string
  confidence: number   // 0–100 (Hunter's own scale)
  found:      boolean
}

interface HunterApiEmail {
  value:      string
  confidence: number
}

interface HunterApiResponse {
  data: {
    emails: HunterApiEmail[]
  }
}

// ── Service ────────────────────────────────────────────────────

/**
 * Searches Hunter.io for the highest-confidence email for a given domain.
 *
 * - Returns ok({ found: false }) when the domain has no emails on Hunter.
 * - Returns err(RateLimitedError) on 429.
 * - Returns err(ExternalApiError) on any other failure.
 */
export async function findEmailByDomain(
  domain: string,
): Promise<Result<HunterEmailResult, AppError>> {
  logger.info({ domain, provider: 'hunter.io' }, 'Email enrichment started')

  let response: HunterApiResponse | null = null

  try {
    response = await ky
      .get('https://api.hunter.io/v2/domain-search', {
        searchParams: { domain, api_key: env.HUNTER_API_KEY },
        timeout: 10_000,
        throwHttpErrors: true,
        retry: 0,
      })
      .json<HunterApiResponse>()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('429')) {
      logger.warn({ domain }, 'Hunter.io rate limited')
      return err(new RateLimitedError('hunter.io'))
    }
    logger.error({ domain, provider: 'hunter.io', err: e }, 'Hunter API request failed')
    return err(new ExternalApiError('hunter.io', 'Domain search request failed'))
  }

  if (!response.data.emails.length) {
    logger.info({ domain }, 'No emails found for domain')
    return ok({ email: '', confidence: 0, found: false })
  }

  // We already guarded the empty-array case above, so best is always defined
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const best = [...response.data.emails].sort((a, b) => b.confidence - a.confidence)[0]!
  logger.info({ domain, email: best.value, confidence: best.confidence }, 'Email found via Hunter')
  return ok({ email: best.value, confidence: best.confidence, found: true })
}
