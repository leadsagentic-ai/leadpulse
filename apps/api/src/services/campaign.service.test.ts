import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ok, err } from 'neverthrow'
import {
  createCampaign,
  listCampaigns,
  getCampaignById,
  updateCampaign,
  patchCampaignStatus,
  deleteCampaign,
} from './campaign.service'
import { NotFoundError, ForbiddenError } from '@/lib/errors'
import type { Campaign } from '@/db/schema/campaigns.schema'
import type { Database } from '@/db'

// ---------- Helpers ----------

const USER_ID = 'user-uuid-001'
const OTHER_USER_ID = 'user-uuid-002'
const CAMPAIGN_ID = 'campaign-uuid-001'

const baseCampaign: Campaign = {
  id: CAMPAIGN_ID,
  userId: USER_ID,
  name: 'Test Campaign',
  keywords: ['saas', 'crm'],
  exclusionKeywords: [],
  intentFilters: [],
  platforms: ['reddit'],
  subredditTargets: ['r/saas'],
  language: 'en',
  minEngagement: 0,
  personaFilter: null,
  geoFilter: [],
  notificationFreq: 'daily',
  status: 'active',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
}

function mockDb(overrides: Partial<Record<string, unknown>> = {}): Database {
  // Build a minimal drizzle-like mock
  const selectResult: Campaign[] = overrides['selectResult'] as Campaign[] ?? [baseCampaign]
  const insertResult: Campaign[] = overrides['insertResult'] as Campaign[] ?? [baseCampaign]
  const updateResult: Campaign[] = overrides['updateResult'] as Campaign[] ?? [{ ...baseCampaign, updatedAt: new Date() }]
  const countResult = [{ value: BigInt(selectResult.length) }]

  const chain: Record<string, unknown> = {}

  // select chain
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue(selectResult),
  }

  // count chain
  const countChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(countResult),
  }

  const db = {
    select: vi.fn((fields?: unknown) => {
      // If called with count selector, return countChain
      if (fields && typeof fields === 'object' && 'value' in (fields as object)) {
        return countChain
      }
      return selectChain
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(insertResult),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(updateResult),
        }),
      }),
    }),
  } as unknown as Database

  return db
}

// ---------- Tests ----------

describe('createCampaign', () => {
  it('creates and returns a campaign', async () => {
    const db = mockDb()
    const result = await createCampaign(db, USER_ID, {
      name: 'Test Campaign',
      keywords: ['saas'],
      platforms: ['reddit'],
    })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.id).toBe(CAMPAIGN_ID)
      expect(result.value.userId).toBe(USER_ID)
    }
  })

  it('returns error when insert returns nothing', async () => {
    const db = mockDb({ insertResult: [] })
    const result = await createCampaign(db, USER_ID, {
      name: 'Test Campaign',
      keywords: ['saas'],
      platforms: ['reddit'],
    })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.statusCode).toBe(500)
    }
  })
})

describe('getCampaignById', () => {
  it('returns the campaign for the correct owner', async () => {
    const db = mockDb()
    // Make select resolve synchronously with our baseCampaign + limit(1) 
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([baseCampaign]),
    }
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain)

    const result = await getCampaignById(db, USER_ID, CAMPAIGN_ID)
    expect(result.isOk()).toBe(true)
  })

  it('returns NotFoundError when campaign does not exist', async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    }
    const db = mockDb()
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain)

    const result = await getCampaignById(db, USER_ID, 'nonexistent-id')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(NotFoundError)
      expect(result.error.statusCode).toBe(404)
    }
  })

  it('returns ForbiddenError when campaign belongs to another user', async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([baseCampaign]),
    }
    const db = mockDb()
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain)

    const result = await getCampaignById(db, OTHER_USER_ID, CAMPAIGN_ID)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(ForbiddenError)
      expect(result.error.statusCode).toBe(403)
    }
  })
})

describe('patchCampaignStatus', () => {
  it('archives a campaign successfully', async () => {
    const updatedCampaign = { ...baseCampaign, status: 'paused' as const }
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([baseCampaign]),
    }
    const db = mockDb({ updateResult: [updatedCampaign] })
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain)

    const result = await patchCampaignStatus(db, USER_ID, CAMPAIGN_ID, 'paused')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.status).toBe('paused')
    }
  })
})

describe('deleteCampaign', () => {
  it('soft-deletes (archives) a campaign', async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([baseCampaign]),
    }
    const db = mockDb()
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain)

    const result = await deleteCampaign(db, USER_ID, CAMPAIGN_ID)
    expect(result.isOk()).toBe(true)
  })
})
