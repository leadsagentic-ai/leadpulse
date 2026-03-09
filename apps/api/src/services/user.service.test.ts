import { describe, it, expect, vi } from 'vitest'
import { upsertUser, getUserById, getUserByFirebaseUid } from './user.service'
import { NotFoundError } from '@/lib/errors'
import type { User } from '@/db/schema/users.schema'
import type { Database } from '@/db'

const baseUser: User = {
  id: 'user-uuid-001',
  firebaseUid: 'firebase-uid-001',
  email: 'test@example.com',
  fullName: 'Test User',
  planTier: 'starter',
  workspaceId: 'ws-uuid-001',
  monthlyLeadQuota: 200,
  leadsUsedThisMonth: 0,
  createdAt: new Date('2026-01-01'),
  lastLoginAt: null,
}

function buildMockDb(scenario: 'new-user' | 'existing-user' | 'not-found'): Database {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(
      scenario === 'not-found' ? [] : scenario === 'existing-user' ? [baseUser] : [],
    ),
  }

  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ ...baseUser, lastLoginAt: new Date() }]),
    }),
  }

  const workspace = { id: 'ws-uuid-001', name: "Test User's Workspace", ownerUserId: 'pending', planTier: 'starter', createdAt: new Date() }

  return {
    select: vi.fn().mockReturnValue(selectChain),
    insert: vi.fn()
      .mockImplementationOnce(() => ({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([workspace]),
        }),
      }))
      .mockImplementationOnce(() => ({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([baseUser]),
        }),
      })),
    update: vi.fn().mockReturnValue(updateChain),
  } as unknown as Database
}

describe('upsertUser', () => {
  it('returns existing user and updates lastLoginAt on subsequent login', async () => {
    const db = buildMockDb('existing-user')
    const result = await upsertUser(db, 'firebase-uid-001', 'test@example.com', 'Test User')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.firebaseUid).toBe('firebase-uid-001')
    }
  })

  it('creates workspace and user on first login', async () => {
    const db = buildMockDb('new-user')
    const result = await upsertUser(db, 'firebase-uid-new', 'new@example.com', 'New User')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.email).toBe('test@example.com')
    }
  })
})

describe('getUserById', () => {
  it('returns user when found', async () => {
    const db = buildMockDb('existing-user')
    const result = await getUserById(db, 'user-uuid-001')
    expect(result.isOk()).toBe(true)
  })

  it('returns NotFoundError when user not found', async () => {
    const db = buildMockDb('not-found')
    const result = await getUserById(db, 'nonexistent-id')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(NotFoundError)
    }
  })
})
