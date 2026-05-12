import { describe, it, expect, vi, afterEach } from 'vitest'
import { enrichPersonPdl } from './pdl.service'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('ky', () => ({
  default: { get: vi.fn() },
}))

import ky from 'ky'
const mockKyGet = vi.mocked(ky.get)

const TEST_API_KEY = 'test-pdl-key'

function makePdlResponse(status: number, data: object | null) {
  return {
    json: vi.fn().mockResolvedValue({ status, data }),
  }
}

describe('enrichPersonPdl', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns enriched person on a successful hit', async () => {
    mockKyGet.mockReturnValue(makePdlResponse(200, {
      emails:         [{ address: 'jane@acme.com' }],
      phone_numbers:  ['+14155550101'],
      linkedin_url:   'https://linkedin.com/in/jane-doe',
      industry:       'Software',
      job_title:      'VP Engineering',
    }) as never)

    const result = await enrichPersonPdl('Jane Doe', 'Acme Corp', 'acme.com', TEST_API_KEY)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.found).toBe(true)
      expect(result.value.email).toBe('jane@acme.com')
      expect(result.value.phone).toBe('+14155550101')
      expect(result.value.linkedinUrl).toBe('https://linkedin.com/in/jane-doe')
      expect(result.value.industry).toBe('Software')
      expect(result.value.jobTitle).toBe('VP Engineering')
    }
  })

  it('returns found: false on 404 (person not in PDL)', async () => {
    mockKyGet.mockReturnValue(makePdlResponse(404, null) as never)

    const result = await enrichPersonPdl('Unknown Person', null, null, TEST_API_KEY)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.found).toBe(false)
      expect(result.value.email).toBeNull()
    }
  })

  it('returns found: false without calling API when key is absent', async () => {
    const result = await enrichPersonPdl('Jane Doe', 'Acme', 'acme.com', undefined)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.found).toBe(false)
    expect(mockKyGet).not.toHaveBeenCalled()
  })

  it('returns found: false without calling API when name is empty', async () => {
    const result = await enrichPersonPdl('', 'Acme', null, TEST_API_KEY)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.found).toBe(false)
    expect(mockKyGet).not.toHaveBeenCalled()
  })

  it('returns RateLimitedError when status is 429', async () => {
    mockKyGet.mockReturnValue(makePdlResponse(429, null) as never)

    const result = await enrichPersonPdl('Jane Doe', 'Acme', null, TEST_API_KEY)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.code).toBe('RATE_LIMITED')
  })

  it('returns ExternalApiError on 5xx status', async () => {
    mockKyGet.mockReturnValue(makePdlResponse(500, {}) as never)

    const result = await enrichPersonPdl('Jane Doe', 'Acme', null, TEST_API_KEY)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.code).toBe('EXTERNAL_API_ERROR')
  })

  it('returns ExternalApiError on network failure', async () => {
    mockKyGet.mockReturnValue({
      json: vi.fn().mockRejectedValue(new Error('Connection refused')),
    } as never)

    const result = await enrichPersonPdl('Jane Doe', 'Acme', null, TEST_API_KEY)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.code).toBe('EXTERNAL_API_ERROR')
  })

  it('handles null optional fields gracefully', async () => {
    mockKyGet.mockReturnValue(makePdlResponse(200, {
      emails:        [{ address: 'jane@acme.com' }],
      phone_numbers: [],
      linkedin_url:  null,
      industry:      null,
      job_title:     null,
    }) as never)

    const result = await enrichPersonPdl('Jane Doe', 'Acme', null, TEST_API_KEY)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.found).toBe(true)
      expect(result.value.email).toBe('jane@acme.com')
      expect(result.value.phone).toBeNull()
      expect(result.value.linkedinUrl).toBeNull()
    }
  })
})
