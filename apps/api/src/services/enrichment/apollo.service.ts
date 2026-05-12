import ky from 'ky'
import { ok, err, type Result } from 'neverthrow'
import { ExternalApiError, RateLimitedError, type AppError } from '@/lib/errors'
import { logger } from '@/lib/logger'

// ── Contracts ──────────────────────────────────────────────────

export interface ApolloPersonResult {
  found:        boolean
  email:        string | null
  phone:        string | null
  linkedinUrl:  string | null
  jobTitle:     string | null
  industry:     string | null
  companySize:  string | null
}

interface ApolloOrganization {
  industry:               string | null
  estimated_num_employees: number | null
}

interface ApolloPhoneNumber {
  sanitized_number: string
}

interface ApolloPerson {
  email:          string | null
  phone_numbers:  ApolloPhoneNumber[]
  linkedin_url:   string | null
  title:          string | null
  organization:   ApolloOrganization | null
}

interface ApolloMatchResponse {
  person: ApolloPerson | null
}

// ── Helpers ──────────────────────────────────────────────────────

function toCompanySizeLabel(employees: number | null | undefined): string | null {
  if (!employees) return null
  if (employees <= 10)   return '1-10'
  if (employees <= 50)   return '11-50'
  if (employees <= 200)  return '51-200'
  if (employees <= 500)  return '201-500'
  if (employees <= 1000) return '501-1000'
  return '1000+'
}

// ── Service ────────────────────────────────────────────────────

/**
 * Searches Apollo.io for a person by name + company (or domain).
 *
 * Docs: https://apolloio.github.io/apollo-api-docs/?shell#people-match
 *
 * - Returns ok({ found: false }) when Apollo returns no person or key is absent.
 * - Returns err(RateLimitedError) on 429.
 * - Returns err(ExternalApiError) on any other failure.
 */
export async function searchApolloPerson(
  name: string,
  company: string | null,
  domain: string | null,
  apiKey: string | undefined,
): Promise<Result<ApolloPersonResult, AppError>> {
  if (!apiKey) {
    logger.info({ name }, 'Apollo API key not configured — skipping')
    return ok({ found: false, email: null, phone: null, linkedinUrl: null, jobTitle: null, industry: null, companySize: null })
  }

  if (!name.trim()) {
    return ok({ found: false, email: null, phone: null, linkedinUrl: null, jobTitle: null, industry: null, companySize: null })
  }

  logger.info({ name, company, provider: 'apollo.io' }, 'Person enrichment started')

  let response: ApolloMatchResponse | null = null

  try {
    response = await ky
      .post('https://api.apollo.io/api/v1/people/match', {
        json: {
          name,
          ...(company && { organization_name: company }),
          ...(domain  && { domain }),
          reveal_personal_emails: false,
        },
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        timeout: 15_000,
        retry: 0,
      })
      .json<ApolloMatchResponse>()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('429')) {
      return err(new RateLimitedError('apollo.io'))
    }
    logger.error({ name, provider: 'apollo.io', err: e }, 'Apollo request failed')
    return err(new ExternalApiError('apollo.io', 'Person match request failed'))
  }

  const person = response?.person
  if (!person) {
    logger.info({ name, provider: 'apollo.io' }, 'No person found')
    return ok({ found: false, email: null, phone: null, linkedinUrl: null, jobTitle: null, industry: null, companySize: null })
  }

  const result: ApolloPersonResult = {
    found:       true,
    email:       person.email ?? null,
    phone:       person.phone_numbers[0]?.sanitized_number ?? null,
    linkedinUrl: person.linkedin_url ?? null,
    jobTitle:    person.title ?? null,
    industry:    person.organization?.industry ?? null,
    companySize: toCompanySizeLabel(person.organization?.estimated_num_employees),
  }

  logger.info({ name, email: result.email, provider: 'apollo.io' }, 'Person found')
  return ok(result)
}
