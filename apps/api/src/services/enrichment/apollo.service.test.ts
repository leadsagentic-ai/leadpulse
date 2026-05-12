import { describe, it, expect, vi, afterEach } from 'vitest'
import { searchApolloPerson } from './apollo.service'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('ky', () => ({
  default: { post: vi.fn() },
}))

import ky from 'ky'
const mockKyPost = vi.mocked(ky.post)

const TEST_API_KEY = 'test-apollo-key'

function makeApolloResponse(person: object | null) {
  return {
    json: vi.fn().mockResolvedValue({ person }),
  }
}

describe('searchApolloPerson', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns found person with all fields on a full match', async () => {
    mockKyPost.mockReturnValue(makeApolloResponse({
      email:         'jane@acme.com',
      phone_numbers: [{ sanitized_number: '+14155550101' }],
      linkedin_url:  'https://linkedin.com/in/jane-doe',
      title:         'VP Engineering',
      organization: {
        industry:                'Software',
        estimated_num_employees: 150,
      },
    }) as never)

    const result = await searchApolloPerson('Jane Doe', 'Acme Corp', 'acme.com', TEST_API_KEY)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.found).toBe(true)
      expect(result.value.email).toBe('jane@acme.com')
      expect(result.value.phone).toBe('+14155550101')
      expect(result.value.linkedinUrl).toBe('https://linkedin.com/in/jane-doe')
      expect(result.value.jobTitle).toBe('VP Engineering')
      expect(result.value.industry).toBe('Software')
      expect(result.value.companySize).toBe('51-200')
    }
  })

  it('returns found: false when person is null in response', async () => {
    mockKyPost.mockReturnValue(makeApolloResponse(null) as never)

    const result = await searchApolloPerson('Unknown Person', 'Acme', null, TEST_API_KEY)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.found).toBe(false)
      expect(result.value.email).toBeNull()
    }
  })

  it('returns found: false without calling API when key is absent', async () => {
    const result = await searchApolloPerson('Jane Doe', 'Acme', 'acme.com', undefined)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.found).toBe(false)
    expect(mockKyPost).not.toHaveBeenCalled()
  })

  it('returns found: false without calling API when name is empty', async () => {
    const result = await searchApolloPerson('', 'Acme', 'acme.com', TEST_API_KEY)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.found).toBe(false)
    expect(mockKyPost).not.toHaveBeenCalled()
  })

  it('returns RateLimitedError on 429', async () => {
    mockKyPost.mockReturnValue({
      json: vi.fn().mockRejectedValue(new Error('429 Too Many Requests')),
    } as never)

    const result = await searchApolloPerson('Jane Doe', 'Acme', null, TEST_API_KEY)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.code).toBe('RATE_LIMITED')
  })

  it('returns ExternalApiError on generic network failure', async () => {
    mockKyPost.mockReturnValue({
      json: vi.fn().mockRejectedValue(new Error('Network error')),
    } as never)

    const result = await searchApolloPerson('Jane Doe', 'Acme', null, TEST_API_KEY)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.code).toBe('EXTERNAL_API_ERROR')
  })

  it('maps employee count to correct company size labels', async () => {
    const sizes: Array<[number, string]> = [
      [5, '1-10'], [25, '11-50'], [100, '51-200'],
      [300, '201-500'], [750, '501-1000'], [5000, '1000+'],
    ]

    for (const [employees, expected] of sizes) {
      mockKyPost.mockReturnValue(makeApolloResponse({
        email: 'x@acme.com',
        phone_numbers: [],
        linkedin_url: null,
        title: null,
        organization: { industry: null, estimated_num_employees: employees },
      }) as never)

      const result = await searchApolloPerson('Jane', 'Acme', null, TEST_API_KEY)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value.companySize).toBe(expected)
    }
  })

  it('handles person with no phone_numbers gracefully', async () => {
    mockKyPost.mockReturnValue(makeApolloResponse({
      email: 'jane@acme.com',
      phone_numbers: [],
      linkedin_url: null,
      title: null,
      organization: null,
    }) as never)

    const result = await searchApolloPerson('Jane Doe', 'Acme', null, TEST_API_KEY)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.found).toBe(true)
      expect(result.value.phone).toBeNull()
      expect(result.value.companySize).toBeNull()
    }
  })
})
