import { describe, it, expect, vi, afterEach } from 'vitest'
import { findEmailByDomain } from './hunter.service'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// Mock ky globally
vi.mock('ky', () => ({
  default: { get: vi.fn() },
}))

import ky from 'ky'
const mockKyGet = vi.mocked(ky.get)

const TEST_API_KEY = 'test-hunter-key'

function makeHunterResponse(emails: { value: string; confidence: number }[]) {
  return {
    json: vi.fn().mockResolvedValue({ data: { emails } }),
  }
}

describe('findEmailByDomain', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns the highest-confidence email on success', async () => {
    mockKyGet.mockReturnValue(makeHunterResponse([
      { value: 'jane@acme.com', confidence: 72 },
      { value: 'john@acme.com', confidence: 94 },
    ]) as never)

    const result = await findEmailByDomain('acme.com', TEST_API_KEY)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.email).toBe('john@acme.com')
      expect(result.value.confidence).toBe(94)
      expect(result.value.found).toBe(true)
    }
  })

  it('returns ok({ found: false }) when no emails found', async () => {
    mockKyGet.mockReturnValue(makeHunterResponse([]) as never)

    const result = await findEmailByDomain('unknown-domain.com', TEST_API_KEY)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.found).toBe(false)
      expect(result.value.email).toBe('')
      expect(result.value.confidence).toBe(0)
    }
  })

  it('returns err(EXTERNAL_API_ERROR) on network failure', async () => {
    mockKyGet.mockReturnValue({
      json: vi.fn().mockRejectedValue(new Error('Network error')),
    } as never)

    const result = await findEmailByDomain('acme.com', TEST_API_KEY)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('EXTERNAL_API_ERROR')
    }
  })

  it('returns err(RATE_LIMITED) on 429 error', async () => {
    mockKyGet.mockReturnValue({
      json: vi.fn().mockRejectedValue(new Error('429 Too Many Requests')),
    } as never)

    const result = await findEmailByDomain('acme.com', TEST_API_KEY)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('RATE_LIMITED')
    }
  })

  it('sends the correct searchParams including api_key', async () => {
    mockKyGet.mockReturnValue(makeHunterResponse([]) as never)

    await findEmailByDomain('test-company.com', TEST_API_KEY)

    expect(mockKyGet).toHaveBeenCalledWith(
      'https://api.hunter.io/v2/domain-search',
      expect.objectContaining({
        searchParams: { domain: 'test-company.com', api_key: TEST_API_KEY },
      }),
    )
  })

  it('picks highest confidence even when array is unordered', async () => {
    mockKyGet.mockReturnValue(makeHunterResponse([
      { value: 'low@acme.com',  confidence: 30 },
      { value: 'high@acme.com', confidence: 95 },
      { value: 'mid@acme.com',  confidence: 60 },
    ]) as never)

    const result = await findEmailByDomain('acme.com', TEST_API_KEY)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.email).toBe('high@acme.com')
    }
  })

  it('returns ok({ found: false }) when apiKey is undefined', async () => {
    const result = await findEmailByDomain('acme.com', undefined)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.found).toBe(false)
    }
  })
})
