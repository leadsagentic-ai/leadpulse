import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Mock TanStack Router so Link renders as a plain anchor — no router context needed
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode; params?: object }) => (
    <a href={to} {...props}>{children}</a>
  ),
}))

import { LeadCard } from './LeadCard'
import type { Lead } from '@/lib/types'

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 'lead-1',
    campaignId: 'campaign-1',
    userId: 'user-1',
    platform: 'reddit',
    postUrl: 'https://reddit.com/r/test/comments/abc',
    postText: 'We are evaluating CRM tools for our enterprise sales team.',
    postPublishedAt: new Date().toISOString(),
    postEngagement: 42,
    intentType: 'BUYING_INTENT',
    intentConfidence: '0.92',
    intentJustification: 'Post indicates active purchase evaluation.',
    urgencyScore: '0.80',
    personaMatchScore: '0.70',
    name: 'Alice Johnson',
    username: 'alice_j',
    platformProfileUrl: 'https://reddit.com/u/alice_j',
    jobTitle: 'VP of Sales',
    company: 'Acme Corp',
    companyDomain: 'acme.com',
    location: 'San Francisco, CA',
    industry: 'SaaS',
    companySize: '200-500',
    email: 'alice@acme.com',
    emailStatus: 'VALID',
    emailProvider: 'google',
    phone: null,
    linkedinUrl: 'https://linkedin.com/in/alicejohnson',
    leadScore: 85,
    scoreTier: 'HOT',
    status: 'pending',
    complianceGdprSafe: true,
    complianceDpdpSafe: true,
    enrichedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

// ── Score badge ───────────────────────────────────────────────────────────────

describe('LeadCard — score badge', () => {
  it('displays the numeric lead score', () => {
    render(<LeadCard lead={makeLead({ leadScore: 85, scoreTier: 'HOT' })} />)
    expect(screen.getByText('85')).toBeInTheDocument()
  })

  it('displays HOT tier label', () => {
    render(<LeadCard lead={makeLead({ scoreTier: 'HOT' })} />)
    expect(screen.getByText('HOT')).toBeInTheDocument()
  })

  it('displays WARM tier label', () => {
    render(<LeadCard lead={makeLead({ leadScore: 65, scoreTier: 'WARM' })} />)
    expect(screen.getByText('WARM')).toBeInTheDocument()
  })

  it('displays COOL tier label', () => {
    render(<LeadCard lead={makeLead({ leadScore: 45, scoreTier: 'COOL' })} />)
    expect(screen.getByText('COOL')).toBeInTheDocument()
  })

  it('displays WEAK tier label', () => {
    render(<LeadCard lead={makeLead({ leadScore: 25, scoreTier: 'WEAK' })} />)
    expect(screen.getByText('WEAK')).toBeInTheDocument()
  })

  it('displays DISCARD tier label', () => {
    render(<LeadCard lead={makeLead({ leadScore: 10, scoreTier: 'DISCARD' })} />)
    expect(screen.getByText('DISCARD')).toBeInTheDocument()
  })
})

// ── Intent badge ──────────────────────────────────────────────────────────────

describe('LeadCard — intent badge', () => {
  it('shows "Buying" for BUYING_INTENT', () => {
    render(<LeadCard lead={makeLead({ intentType: 'BUYING_INTENT' })} />)
    expect(screen.getByText('Buying')).toBeInTheDocument()
  })

  it('shows "Pain" for PAIN_SIGNAL', () => {
    render(<LeadCard lead={makeLead({ intentType: 'PAIN_SIGNAL' })} />)
    expect(screen.getByText('Pain')).toBeInTheDocument()
  })

  it('shows "Comparing" for COMPARISON_INTENT', () => {
    render(<LeadCard lead={makeLead({ intentType: 'COMPARISON_INTENT' })} />)
    expect(screen.getByText('Comparing')).toBeInTheDocument()
  })

  it('shows "Hiring" for HIRING_INTENT', () => {
    render(<LeadCard lead={makeLead({ intentType: 'HIRING_INTENT' })} />)
    expect(screen.getByText('Hiring')).toBeInTheDocument()
  })

  it('shows "Announcement" for ANNOUNCEMENT_INTENT', () => {
    render(<LeadCard lead={makeLead({ intentType: 'ANNOUNCEMENT_INTENT' })} />)
    expect(screen.getByText('Announcement')).toBeInTheDocument()
  })
})

// ── Identity info ─────────────────────────────────────────────────────────────

describe('LeadCard — identity', () => {
  it('shows lead name when available', () => {
    render(<LeadCard lead={makeLead({ name: 'Alice Johnson' })} />)
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
  })

  it('falls back to username when name is null', () => {
    render(<LeadCard lead={makeLead({ name: null, username: 'alice_j' })} />)
    expect(screen.getByText('alice_j')).toBeInTheDocument()
  })

  it('shows platform name', () => {
    render(<LeadCard lead={makeLead({ platform: 'bluesky' })} />)
    expect(screen.getByText('bluesky')).toBeInTheDocument()
  })

  it('shows job title when available', () => {
    render(<LeadCard lead={makeLead({ jobTitle: 'VP of Sales' })} />)
    expect(screen.getByText(/VP of Sales/)).toBeInTheDocument()
  })

  it('shows company when available', () => {
    render(<LeadCard lead={makeLead({ company: 'Acme Corp' })} />)
    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument()
  })

  it('shows post excerpt', () => {
    render(<LeadCard lead={makeLead({ postText: 'Unique excerpt text here.' })} />)
    expect(screen.getByText(/Unique excerpt text here/)).toBeInTheDocument()
  })
})

// ── Status actions ─────────────────────────────────────────────────────────────

describe('LeadCard — status actions', () => {
  it('calls onStatusChange with "approved" when Approve is clicked', () => {
    const onStatusChange = vi.fn()
    render(<LeadCard lead={makeLead({ id: 'lead-42' })} onStatusChange={onStatusChange} />)
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))
    expect(onStatusChange).toHaveBeenCalledWith('lead-42', 'approved')
  })

  it('calls onStatusChange with "discarded" when Discard is clicked', () => {
    const onStatusChange = vi.fn()
    render(<LeadCard lead={makeLead({ id: 'lead-42' })} onStatusChange={onStatusChange} />)
    fireEvent.click(screen.getByRole('button', { name: /discard/i }))
    expect(onStatusChange).toHaveBeenCalledWith('lead-42', 'discarded')
  })

  it('does not render action buttons when onStatusChange is not provided', () => {
    render(<LeadCard lead={makeLead()} />)
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /discard/i })).not.toBeInTheDocument()
  })
})
