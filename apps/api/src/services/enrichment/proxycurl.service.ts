import ky from 'ky'
import { ok, err, type Result } from 'neverthrow'
import { ExternalApiError, RateLimitedError, type AppError } from '@/lib/errors'
import { logger } from '@/lib/logger'

// ── Contracts ──────────────────────────────────────────────────

export interface ProxycurlProfileResult {
  found:       boolean
  name:        string | null
  jobTitle:    string | null
  company:     string | null
  industry:    string | null
  location:    string | null
}

interface ProxycurlExperience {
  company: string | null
  title:   string | null
  ends_at: { year: number } | null
}

interface ProxycurlApiResponse {
  full_name:   string | null
  occupation:  string | null
  experiences: ProxycurlExperience[] | null
  industry:    string | null
  country:     string | null
  city:        string | null
}

// ── Helpers ──────────────────────────────────────────────────────

/** Returns the most recent (current/last) employer from LinkedIn experience list */
function currentCompany(experiences: ProxycurlExperience[] | null | undefined): string | null {
  if (!experiences?.length) return null
  // Current jobs have no end_at
  const current = experiences.find((e) => e.ends_at === null)
  return current?.company ?? experiences[0]?.company ?? null
}

// ── Service ────────────────────────────────────────────────────

/**
 * Scrapes a LinkedIn profile via Proxycurl to enrich lead identity data.
 *
 * Docs: https://nubela.co/proxycurl/docs#people-api-linkedin-profile-endpoint
 *
 * Only called when a `linkedinUrl` is available on the lead.
 * - Returns ok({ found: false }) when URL is absent or key is missing.
 * - Returns err(RateLimitedError) on 429.
 * - Returns err(ExternalApiError) on any other failure.
 */
export async function scrapeLinkedInProfile(
  linkedinUrl: string | null | undefined,
  apiKey: string | undefined,
): Promise<Result<ProxycurlProfileResult, AppError>> {
  if (!apiKey) {
    logger.info('Proxycurl API key not configured — skipping')
    return ok({ found: false, name: null, jobTitle: null, company: null, industry: null, location: null })
  }

  if (!linkedinUrl) {
    return ok({ found: false, name: null, jobTitle: null, company: null, industry: null, location: null })
  }

  logger.info({ linkedinUrl, provider: 'proxycurl' }, 'LinkedIn profile scrape started')

  let response: ProxycurlApiResponse | null = null

  try {
    response = await ky
      .get('https://nubela.co/proxycurl/api/v2/linkedin', {
        searchParams: { url: linkedinUrl },
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 20_000,
        retry: 0,
      })
      .json<ProxycurlApiResponse>()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('429')) {
      return err(new RateLimitedError('proxycurl'))
    }
    logger.error({ linkedinUrl, provider: 'proxycurl', err: e }, 'Proxycurl request failed')
    return err(new ExternalApiError('proxycurl', 'LinkedIn profile scrape failed'))
  }

  if (!response?.full_name) {
    logger.info({ linkedinUrl, provider: 'proxycurl' }, 'Empty profile returned')
    return ok({ found: false, name: null, jobTitle: null, company: null, industry: null, location: null })
  }

  const location = [response.city, response.country].filter(Boolean).join(', ') || null

  const result: ProxycurlProfileResult = {
    found:    true,
    name:     response.full_name ?? null,
    jobTitle: response.occupation ?? null,
    company:  currentCompany(response.experiences),
    industry: response.industry ?? null,
    location,
  }

  logger.info({ linkedinUrl, name: result.name, provider: 'proxycurl' }, 'LinkedIn profile scraped')
  return ok(result)
}
