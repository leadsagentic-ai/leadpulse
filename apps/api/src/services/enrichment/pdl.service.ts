import ky from 'ky'
import { ok, err, type Result } from 'neverthrow'
import { ExternalApiError, RateLimitedError, type AppError } from '@/lib/errors'
import { logger } from '@/lib/logger'

// ── Contracts ──────────────────────────────────────────────────

export interface PdlPersonResult {
  found:       boolean
  email:       string | null
  phone:       string | null
  linkedinUrl: string | null
  industry:    string | null
  jobTitle:    string | null
}

interface PdlApiResponse {
  status:        number
  data: {
    emails:         Array<{ address: string }>
    phone_numbers:  string[]
    linkedin_url:   string | null
    industry:       string | null
    job_title:      string | null
  } | null
}

// ── Service ────────────────────────────────────────────────────

/**
 * Enriches a person via People Data Labs (PDL) `/v5/person/enrich`.
 *
 * Docs: https://docs.peopledatalabs.com/docs/person-enrichment-api
 *
 * Matching params we send: name + (company or domain).
 * - Returns ok({ found: false }) on 404 or missing key.
 * - Returns err(RateLimitedError) on 429.
 * - Returns err(ExternalApiError) on any other failure.
 */
export async function enrichPersonPdl(
  name: string,
  company: string | null,
  domain: string | null,
  apiKey: string | undefined,
): Promise<Result<PdlPersonResult, AppError>> {
  if (!apiKey) {
    logger.info({ name }, 'PDL API key not configured — skipping')
    return ok({ found: false, email: null, phone: null, linkedinUrl: null, industry: null, jobTitle: null })
  }

  if (!name.trim()) {
    return ok({ found: false, email: null, phone: null, linkedinUrl: null, industry: null, jobTitle: null })
  }

  logger.info({ name, company, provider: 'pdl' }, 'Person enrichment started')

  let response: PdlApiResponse | null = null

  try {
    response = await ky
      .get('https://api.peopledatalabs.com/v5/person/enrich', {
        searchParams: {
          name,
          ...(company && { company }),
          ...(domain  && { domain }),
          pretty: 'false',
        },
        headers: { 'X-Api-Key': apiKey },
        timeout: 15_000,
        retry: 0,
        // PDL returns 404 when person not found — don't throw, handle below
        throwHttpErrors: false,
      })
      .json<PdlApiResponse>()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('429')) {
      return err(new RateLimitedError('pdl'))
    }
    logger.error({ name, provider: 'pdl', err: e }, 'PDL request failed')
    return err(new ExternalApiError('pdl', 'Person enrich request failed'))
  }

  if (!response) {
    return err(new ExternalApiError('pdl', 'Empty response'))
  }

  if (response.status === 429) {
    return err(new RateLimitedError('pdl'))
  }

  if (response.status === 404 || !response.data) {
    logger.info({ name, provider: 'pdl' }, 'Person not found in PDL')
    return ok({ found: false, email: null, phone: null, linkedinUrl: null, industry: null, jobTitle: null })
  }

  if (response.status >= 400) {
    return err(new ExternalApiError('pdl', `Unexpected status ${response.status}`))
  }

  const d = response.data
  const result: PdlPersonResult = {
    found:       true,
    email:       d.emails?.[0]?.address ?? null,
    phone:       d.phone_numbers?.[0] ?? null,
    linkedinUrl: d.linkedin_url ?? null,
    industry:    d.industry ?? null,
    jobTitle:    d.job_title ?? null,
  }

  logger.info({ name, email: result.email, provider: 'pdl' }, 'Person found in PDL')
  return ok(result)
}
