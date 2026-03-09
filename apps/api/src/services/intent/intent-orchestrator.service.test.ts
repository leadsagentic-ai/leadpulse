import { describe, it, expect, vi, beforeEach } from 'vitest'
import { classifyIntent } from './intent-orchestrator.service'

// Mock ky globally — same pattern as other service tests
vi.mock('ky', () => ({
  default: {
    post: vi.fn(),
  },
  HTTPError: class HTTPError extends Error {
    constructor(public response: { status: number }) {
      super(`HTTP ${response.status}`)
      this.name = 'HTTPError'
    }
  },
  TimeoutError: class TimeoutError extends Error {
    constructor() {
      super('Timeout')
      this.name = 'TimeoutError'
    }
  },
}))

import ky, { HTTPError, TimeoutError } from 'ky'

const mockKyPost = vi.mocked(ky.post)

const TEST_ENV = {
  ML_SERVICE_URL:    'http://localhost:8000',
  ML_SERVICE_SECRET: 'test-secret-for-vitest',
}

const SAMPLE_POST = 'We are actively evaluating enterprise CRM tools for our sales team this quarter'

function makeMlResponse(overrides?: Partial<{
  intent_type:   string
  confidence:    number
  urgency_score: number
  justification: string
  sentiment:     string
}>) {
  return {
    intent_type:   'BUYING_INTENT',
    confidence:    0.92,
    urgency_score: 0.75,
    justification: 'The post clearly signals purchase evaluation intent for CRM software.',
    sentiment:     'POSITIVE',
    ...overrides,
  }
}

describe('classifyIntent', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ok(IntentResult) on a successful ML response', async () => {
    mockKyPost.mockReturnValue({
      json: vi.fn().mockResolvedValue(makeMlResponse()),
    } as never)

    const result = await classifyIntent(SAMPLE_POST, null, null, 'reddit', TEST_ENV)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.intentType).toBe('BUYING_INTENT')
      expect(result.value.confidence).toBe(0.92)
      expect(result.value.urgencyScore).toBe(0.75)
      expect(result.value.sentiment).toBe('POSITIVE')
      expect(result.value.justification).toMatch(/intent/)
    }
  })

  it('maps snake_case ML response to camelCase IntentResult', async () => {
    mockKyPost.mockReturnValue({
      json: vi.fn().mockResolvedValue(
        makeMlResponse({ intent_type: 'PAIN_SIGNAL', urgency_score: 0.88 }),
      ),
    } as never)

    const result = await classifyIntent(SAMPLE_POST, null, null, 'bluesky', TEST_ENV)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.intentType).toBe('PAIN_SIGNAL')
      expect(result.value.urgencyScore).toBe(0.88)
      // Confirm no snake_case keys bleed through
      expect(result.value).not.toHaveProperty('intent_type')
      expect(result.value).not.toHaveProperty('urgency_score')
    }
  })

  it('sends Authorization: Bearer header with ML_SERVICE_SECRET', async () => {
    mockKyPost.mockReturnValue({
      json: vi.fn().mockResolvedValue(makeMlResponse()),
    } as never)

    await classifyIntent(SAMPLE_POST, null, null, 'reddit', TEST_ENV)

    expect(mockKyPost).toHaveBeenCalledWith(
      'http://localhost:8000/classify',
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-secret-for-vitest' },
        timeout: 30_000,
        retry:   0,
      }),
    )
  })

  it('passes postText, authorBio, personaFilter, platform in JSON body', async () => {
    mockKyPost.mockReturnValue({
      json: vi.fn().mockResolvedValue(makeMlResponse()),
    } as never)

    await classifyIntent('Sample CRM buying text for testing', 'VP of Sales', 'B2B SaaS', 'linkedin', TEST_ENV)

    expect(mockKyPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        json: {
          post_text:      'Sample CRM buying text for testing',
          author_bio:     'VP of Sales',
          persona_filter: 'B2B SaaS',
          platform:       'linkedin',
        },
      }),
    )
  })

  it('returns err(ExternalApiError) on network timeout', async () => {
    mockKyPost.mockReturnValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      json: vi.fn().mockRejectedValue(new (TimeoutError as any)()),
    } as never)

    const result = await classifyIntent(SAMPLE_POST, null, null, 'reddit', TEST_ENV)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('EXTERNAL_API_ERROR')
      expect(result.error.message).toContain('ml-service')
    }
  })

  it('returns err(ExternalApiError) on HTTP 500 from ML service', async () => {
    mockKyPost.mockReturnValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      json: vi.fn().mockRejectedValue(new (HTTPError as any)({ status: 500 })),
    } as never)

    const result = await classifyIntent(SAMPLE_POST, null, null, 'reddit', TEST_ENV)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('EXTERNAL_API_ERROR')
    }
  })

  it('returns err(ExternalApiError) on HTTP 401 (misconfigured secret)', async () => {
    mockKyPost.mockReturnValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      json: vi.fn().mockRejectedValue(new (HTTPError as any)({ status: 401 })),
    } as never)

    const result = await classifyIntent(SAMPLE_POST, null, null, 'threads', TEST_ENV)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('EXTERNAL_API_ERROR')
    }
  })

  it('returns err(ExternalApiError) on unexpected thrown errors', async () => {
    mockKyPost.mockReturnValue({
      json: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    } as never)

    const result = await classifyIntent(SAMPLE_POST, null, null, 'mastodon', TEST_ENV)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('EXTERNAL_API_ERROR')
    }
  })

  it('handles null authorBio and personaFilter', async () => {
    mockKyPost.mockReturnValue({
      json: vi.fn().mockResolvedValue(makeMlResponse()),
    } as never)

    const result = await classifyIntent(SAMPLE_POST, null, null, 'reddit', TEST_ENV)
    expect(result.isOk()).toBe(true)

    expect(mockKyPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        json: expect.objectContaining({ author_bio: null, persona_filter: null }),
      }),
    )
  })
})
