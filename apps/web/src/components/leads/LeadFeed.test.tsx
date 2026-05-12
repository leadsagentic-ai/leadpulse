import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}))

// vi.hoisted ensures these are defined before vi.mock factories run
const { mockUseSuspenseQuery, mockUseUpdateLeadStatus } = vi.hoisted(() => ({
  mockUseSuspenseQuery: vi.fn(),
  mockUseUpdateLeadStatus: vi.fn(),
}))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useSuspenseQuery: mockUseSuspenseQuery,
    useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
    useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
  }
})

vi.mock('@/lib/queries/leads.queries', () => ({
  leadsQueryOptions: (filters: unknown) => ({ queryKey: ['leads', filters], queryFn: vi.fn() }),
  useUpdateLeadStatus: mockUseUpdateLeadStatus,
}))

import { LeadFeed } from './LeadFeed'
import type { Lead } from '@/lib/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeLead(id: string, overrides: Partial<Lead> = {}): Lead {
  return {
    id,
    campaignId: 'campaign-1',
    userId: 'user-1',
    platform: 'reddit',
    postUrl: 'https://reddit.com/r/test/comments/' + id,
    postText: `Post text for lead ${id}`,
    postPublishedAt: new Date().toISOString(),
    postEngagement: 10,
    intentType: 'BUYING_INTENT',
    intentConfidence: '0.90',
    intentJustification: 'Evaluation post',
    urgencyScore: '0.75',
    personaMatchScore: '0.60',
    name: `User ${id}`,
    username: `user_${id}`,
    platformProfileUrl: `https://reddit.com/u/user_${id}`,
    jobTitle: null,
    company: null,
    companyDomain: null,
    location: null,
    industry: null,
    companySize: null,
    email: null,
    emailStatus: null,
    emailProvider: null,
    phone: null,
    linkedinUrl: null,
    leadScore: 55,
    scoreTier: 'WARM',
    status: 'pending',
    complianceGdprSafe: true,
    complianceDpdpSafe: true,
    enrichedAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LeadFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseUpdateLeadStatus.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    })
  })

  it('shows empty state when no leads returned', async () => {
    mockUseSuspenseQuery.mockReturnValue({
      data: { data: [], meta: { page: 1, limit: 20, total: 0, hasMore: false } },
    })

    render(<LeadFeed filters={{}} />)
    await waitFor(() =>
      expect(screen.getByText(/no leads match the selected filters/i)).toBeInTheDocument()
    )
  })

  it('renders a LeadCard for each lead', async () => {
    const leads = [makeLead('1'), makeLead('2'), makeLead('3')]
    mockUseSuspenseQuery.mockReturnValue({
      data: {
        data: leads,
        meta: { page: 1, limit: 20, total: 3, hasMore: false },
      },
    })

    render(<LeadFeed filters={{}} />)
    await waitFor(() => {
      expect(screen.getByText('User 1')).toBeInTheDocument()
      expect(screen.getByText('User 2')).toBeInTheDocument()
      expect(screen.getByText('User 3')).toBeInTheDocument()
    })
  })

  it('shows total lead count', async () => {
    mockUseSuspenseQuery.mockReturnValue({
      data: {
        data: [makeLead('1')],
        meta: { page: 1, limit: 20, total: 42, hasMore: false },
      },
    })

    render(<LeadFeed filters={{}} />)
    await waitFor(() =>
      expect(screen.getByText(/showing 1 of 42 leads/i)).toBeInTheDocument()
    )
  })

  it('passes filters to leadsQueryOptions', async () => {
    const { leadsQueryOptions } = await import('@/lib/queries/leads.queries')
    const capturedOptions = vi.fn()
    mockUseSuspenseQuery.mockImplementation((opts) => {
      capturedOptions(opts)
      return { data: { data: [], meta: { page: 1, limit: 20, total: 0, hasMore: false } } }
    })

    const filters = { platform: 'reddit', intentType: 'BUYING_INTENT' as const }
    render(<LeadFeed filters={filters} />)

    await waitFor(() => {
      const called = mockUseSuspenseQuery.mock.calls[0]?.[0]
      expect(called?.queryKey).toEqual(['leads', filters])
    })
  })
})
