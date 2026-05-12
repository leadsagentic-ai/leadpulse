import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks (hoisted — must be before any imports that trigger them) ────────────

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

const mockCreateCampaign = vi.fn()
vi.mock('@/lib/queries/campaigns.queries', () => ({
  useCreateCampaign: () => ({
    mutateAsync: mockCreateCampaign,
    isPending: false,
  }),
}))

import { CampaignWizard } from './CampaignWizard'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fillStep1(name = 'My Campaign', keywords = 'crm, salesforce') {
  fireEvent.change(screen.getByPlaceholderText(/e.g. SaaS decision makers/i), {
    target: { value: name },
  })
  fireEvent.change(screen.getByPlaceholderText(/e.g. CRM, Salesforce/i), {
    target: { value: keywords },
  })
  fireEvent.click(screen.getByRole('button', { name: /next/i }))
  await waitFor(() => expect(screen.getByText(/platforms/i)).toBeInTheDocument())
}

// ── Step 1 — Campaign Info ─────────────────────────────────────────────────────

describe('CampaignWizard — Step 1: Campaign Info', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    render(<CampaignWizard />)
  })

  it('renders step 1 heading', () => {
    expect(screen.getByText(/campaign info/i)).toBeInTheDocument()
  })

  it('shows campaign name field', () => {
    expect(screen.getByPlaceholderText(/e.g. SaaS decision makers/i)).toBeInTheDocument()
  })

  it('shows keywords field', () => {
    expect(screen.getByPlaceholderText(/e.g. CRM, Salesforce/i)).toBeInTheDocument()
  })

  it('shows error when campaign name is empty on Next', async () => {
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() =>
      expect(screen.getByText(/campaign name is required/i)).toBeInTheDocument()
    )
  })

  it('shows error when keywords are empty on Next', async () => {
    fireEvent.change(screen.getByPlaceholderText(/e.g. SaaS decision makers/i), {
      target: { value: 'My Campaign' },
    })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() =>
      expect(screen.getByText(/at least one keyword is required/i)).toBeInTheDocument()
    )
  })

  it('advances to step 2 when step 1 is valid', async () => {
    await fillStep1()
    // Step 2 shows platform selector
    expect(screen.getByText('Reddit')).toBeInTheDocument()
  })
})

// ── Step 2 — Platforms ─────────────────────────────────────────────────────────

describe('CampaignWizard — Step 2: Platforms', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    render(<CampaignWizard />)
    await fillStep1()
  })

  it('shows all platform options', () => {
    for (const label of ['Reddit', 'Bluesky', 'Threads', 'Mastodon', 'LinkedIn', 'GitHub']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('shows error when no platform selected', async () => {
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() =>
      expect(screen.getByText(/select at least one platform/i)).toBeInTheDocument()
    )
  })

  it('advances to step 3 when at least one platform selected', async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Reddit' }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() =>
      expect(screen.getByText(/intent filters/i)).toBeInTheDocument()
    )
  })

  it('can go back to step 1', () => {
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByPlaceholderText(/e.g. SaaS decision makers/i)).toBeInTheDocument()
  })
})

// ── Step 3 — Intent Filters ────────────────────────────────────────────────────

describe('CampaignWizard — Step 3: Intent Filters', () => {
  async function goToStep3() {
    render(<CampaignWizard />)
    await fillStep1()
    fireEvent.click(screen.getByRole('button', { name: 'Reddit' }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => screen.getByText(/intent filters/i))
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    await goToStep3()
  })

  it('shows all intent type options', () => {
    for (const label of ['Buying Intent', 'Pain Signal', 'Comparison Intent', 'Hiring Intent', 'Announcement Intent']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('advances to step 4 without selecting any intent (all are optional)', async () => {
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() =>
      expect(screen.getByText(/notifications/i)).toBeInTheDocument()
    )
  })
})

// ── Step 4 — Notifications (final step) ───────────────────────────────────────

describe('CampaignWizard — Step 4: Notifications + Submit', () => {
  async function goToStep4() {
    render(<CampaignWizard />)
    await fillStep1()
    // Step 2: select Reddit
    fireEvent.click(screen.getByRole('button', { name: 'Reddit' }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => screen.getByText(/intent filters/i))
    // Step 3: skip intents
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => screen.getByText(/notifications/i))
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    mockCreateCampaign.mockResolvedValue({ id: 'new-campaign-1', name: 'My Campaign' })
    await goToStep4()
  })

  it('shows notification frequency options in select', () => {
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /real-time/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /hourly/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /daily/i })).toBeInTheDocument()
  })

  it('calls createCampaign with correct payload on submit', async () => {
    fireEvent.click(screen.getByRole('button', { name: /create campaign/i }))
    await waitFor(() => {
      expect(mockCreateCampaign).toHaveBeenCalledOnce()
      const arg = mockCreateCampaign.mock.calls[0]?.[0]
      expect(arg).toMatchObject({
        name: 'My Campaign',
        keywords: expect.arrayContaining(['crm', 'salesforce']),
        platforms: ['reddit'],
        notificationFreq: 'daily',
      })
    })
  })
})
