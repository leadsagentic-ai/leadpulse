import { describe, it, expect, vi, afterEach } from 'vitest'
import { scrapeLinkedInProfile } from './proxycurl.service'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('ky', () => ({
  default: { get: vi.fn() },
}))

import ky from 'ky'
const mockKyGet = vi.mocked(ky.get)

const TEST_API_KEY = 'test-proxycurl-key'
const LINKEDIN_URL = 'https://linkedin.com/in/jane-doe'

function makeProxycurlResponse(data: object) {
  return {
    json: vi.fn().mockResolvedValue(data),
  }
}

describe('scrapeLinkedInProfile', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns full profile on successful scrape', async () => {
    mockKyGet.mockReturnValue(makeProxycurlResponse({
      full_name:  'Jane Doe',
      occupation: 'VP Engineering',
      industry:   'Software',
      city:       'San Francisco',
      country:    'US',
      experiences: [
        { company: 'Acme Corp', title: 'VP Engineering', ends_at: null },
        { company: 'Old Corp',  title: 'Senior Engineer', ends_at: { year: 2022 } },
      ],
    }) as never)

    const result = await scrapeLinkedInProfile(LINKEDIN_URL, TEST_API_KEY)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.found).toBe(true)
      expect(result.value.name).toBe('Jane Doe')
      expect(result.value.jobTitle).toBe('VP Engineering')
      expect(result.value.company).toBe('Acme Corp')
      expect(result.value.industry).toBe('Software')
      expect(result.value.location).toBe('San Francisco, US')
    }
  })

  it('returns found: false without calling API when linkedinUrl is null', async () => {
    const result = await scrapeLinkedInProfile(null, TEST_API_KEY)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.found).toBe(false)
    expect(mockKyGet).not.toHaveBeenCalled()
  })

  it('returns found: false without calling API when linkedinUrl is undefined', async () => {
    const result = await scrapeLinkedInProfile(undefined, TEST_API_KEY)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.found).toBe(false)
    expect(mockKyGet).not.toHaveBeenCalled()
  })

  it('returns found: false without calling API when key is absent', async () => {
    const result = await scrapeLinkedInProfile(LINKEDIN_URL, undefined)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.found).toBe(false)
    expect(mockKyGet).not.toHaveBeenCalled()
  })

  it('returns found: false when profile has no full_name (empty/blocked profile)', async () => {
    mockKyGet.mockReturnValue(makeProxycurlResponse({
      full_name: null, occupation: null, experiences: [], industry: null,
    }) as never)

    const result = await scrapeLinkedInProfile(LINKEDIN_URL, TEST_API_KEY)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.found).toBe(false)
  })

  it('returns RateLimitedError on 429', async () => {
    mockKyGet.mockReturnValue({
      json: vi.fn().mockRejectedValue(new Error('429 Too Many Requests')),
    } as never)

    const result = await scrapeLinkedInProfile(LINKEDIN_URL, TEST_API_KEY)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.code).toBe('RATE_LIMITED')
  })

  it('returns ExternalApiError on network failure', async () => {
    mockKyGet.mockReturnValue({
      json: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    } as never)

    const result = await scrapeLinkedInProfile(LINKEDIN_URL, TEST_API_KEY)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.code).toBe('EXTERNAL_API_ERROR')
  })

  it('falls back to first experience as company when no current role', async () => {
    mockKyGet.mockReturnValue(makeProxycurlResponse({
      full_name:  'John Smith',
      occupation: 'Consultant',
      industry:   'Consulting',
      city:       null,
      country:    'UK',
      experiences: [
        { company: 'Last Corp', title: 'Consultant', ends_at: { year: 2023 } },
      ],
    }) as never)

    const result = await scrapeLinkedInProfile(LINKEDIN_URL, TEST_API_KEY)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.found).toBe(true)
      expect(result.value.company).toBe('Last Corp')
      expect(result.value.location).toBe('UK')
    }
  })

  it('builds location with only country when city is null', async () => {
    mockKyGet.mockReturnValue(makeProxycurlResponse({
      full_name:   'Jane Doe',
      occupation:  'CEO',
      industry:    null,
      city:        null,
      country:     'IN',
      experiences: [],
    }) as never)

    const result = await scrapeLinkedInProfile(LINKEDIN_URL, TEST_API_KEY)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.location).toBe('IN')
    }
  })
})
