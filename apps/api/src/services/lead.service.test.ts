import { describe, it, expect, vi } from 'vitest'
import { createLeadFromSignal, getLeadById, patchLeadStatus } from './lead.service'
import { NotFoundError, ForbiddenError } from '@/lib/errors'
import type { Lead } from '@/db/schema/leads.schema'
import type { Database } from '@/db'
import type { SignalProcessingMessage } from '@/queues/signal-processing.queue'

const baseLead: Lead = {
  id:               'lead-uuid-001',
  campaignId:       'campaign-uuid-001',
  userId:           'user-uuid-001',
  platform:         'reddit',
  postUrl:          'https://reddit.com/r/saas/comments/abc123',
  postText:         'Looking for CRM recommendations',
  postPublishedAt:  new Date('2026-01-01'),
  postEngagement:   57,
  intentType:       'BUYING_INTENT',
  intentConfidence: '0.000',
  intentJustification: 'Pending classification',
  urgencyScore:     '0.000',
  personaMatchScore: '0.000',
  username:         'startup_guy',
  platformProfileUrl: 'https://www.reddit.com/u/startup_guy',
  name:             null,
  jobTitle:         null,
  company:          null,
  companyDomain:    null,
  location:         null,
  industry:         null,
  companySize:      null,
  email:            null,
  emailStatus:      null,
  emailProvider:    null,
  phone:            null,
  phoneStatus:      null,
  linkedinUrl:      null,
  leadScore:        0,
  scoreTier:        'WEAK',
  status:           'pending',
  crmPushedAt:      null,
  crmRecordUrl:     null,
  complianceGdprSafe: true,
  complianceDpdpSafe: true,
  createdAt:        new Date('2026-01-01'),
  enrichedAt:       null,
}

const baseSignal: SignalProcessingMessage = {
  rawSignalId:        'abc123',
  campaignId:         'campaign-uuid-001',
  userId:             'user-uuid-001',
  platform:           'reddit',
  postTitle:          'Looking for CRM recommendations',
  postText:           'Looking for CRM recommendations',
  postUrl:            'https://reddit.com/r/saas/comments/abc123',
  authorUsername:     'startup_guy',
  platformProfileUrl: 'https://www.reddit.com/u/startup_guy',
  postPublishedAt:    '2026-01-01T00:00:00.000Z',
  postEngagement:     57,
}

function buildMockDb(scenario: 'found' | 'not-found' | 'insert-ok' | 'insert-fail'): Database {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(
      scenario === 'found' ? [baseLead] : [],
    ),
  }
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(scenario === 'found' ? [{ ...baseLead, status: 'approved' }] : []),
    }),
  }
  return {
    select: vi.fn().mockReturnValue(selectChain),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(scenario === 'insert-ok' ? [baseLead] : []),
      }),
    }),
    update: vi.fn().mockReturnValue(updateChain),
  } as unknown as Database
}

describe('createLeadFromSignal', () => {
  it('creates and returns a lead on success', async () => {
    const db = buildMockDb('insert-ok')
    const result = await createLeadFromSignal(db, baseSignal)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.platform).toBe('reddit')
      expect(result.value.status).toBe('pending')
      expect(result.value.intentType).toBe('BUYING_INTENT')
    }
  })

  it('returns INTERNAL_ERROR when insert returns empty', async () => {
    const db = buildMockDb('insert-fail')
    const result = await createLeadFromSignal(db, baseSignal)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('INTERNAL_ERROR')
    }
  })
})

describe('getLeadById', () => {
  it('returns lead when found and userId matches', async () => {
    const db = buildMockDb('found')
    const result = await getLeadById(db, 'user-uuid-001', 'lead-uuid-001')
    expect(result.isOk()).toBe(true)
  })

  it('returns NotFoundError when lead does not exist', async () => {
    const db = buildMockDb('not-found')
    const result = await getLeadById(db, 'user-uuid-001', 'nonexistent-id')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(NotFoundError)
    }
  })

  it('returns ForbiddenError when userId does not match', async () => {
    const db = buildMockDb('found')
    const result = await getLeadById(db, 'different-user', 'lead-uuid-001')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(ForbiddenError)
    }
  })
})

describe('patchLeadStatus', () => {
  it('updates and returns lead with new status', async () => {
    const db = buildMockDb('found')
    const result = await patchLeadStatus(db, 'user-uuid-001', 'lead-uuid-001', 'approved')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.status).toBe('approved')
    }
  })
})
