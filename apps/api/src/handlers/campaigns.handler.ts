import type { Context } from 'hono'
import { Redis } from '@upstash/redis/cloudflare'
import { createDb } from '@/db'
import * as campaignService from '@/services/campaign.service'
import type { CampaignListResult } from '@/services/campaign.service'

type Env = {
  Bindings: {
    DATABASE_URL: string
    UPSTASH_REDIS_REST_URL?: string
    UPSTASH_REDIS_REST_TOKEN?: string
  }
  Variables: { userId: string }
}

const CAMPAIGN_LIST_TTL = 60   // 60 seconds
const ANALYTICS_TTL = 300      // 5 minutes

function getRedis(c: Context<Env>): Redis | null {
  if (!c.env.UPSTASH_REDIS_REST_URL || !c.env.UPSTASH_REDIS_REST_TOKEN) return null
  return new Redis({ url: c.env.UPSTASH_REDIS_REST_URL, token: c.env.UPSTASH_REDIS_REST_TOKEN })
}

function campaignListKey(userId: string, page: number, limit: number, status: string | undefined): string {
  return `campaigns:list:${userId}:${page}:${limit}:${status ?? 'all'}`
}

function analyticsKey(userId: string, campaignId: string): string {
  return `campaigns:analytics:${userId}:${campaignId}`
}

async function invalidateCampaignCache(redis: Redis | null, userId: string): Promise<void> {
  if (!redis) return
  // Pattern-delete all list keys for this user — scan is safe in Workers via REST
  const keys = await redis.keys(`campaigns:list:${userId}:*`)
  if (keys.length > 0) {
    await redis.del(...(keys as [string, ...string[]]))
  }
}

export async function listCampaigns(c: Context<Env>) {
  const userId = c.get('userId')
  const page = Number(c.req.query('page') ?? 1)
  const limit = Number(c.req.query('limit') ?? 20)
  const status = c.req.query('status') as 'active' | 'paused' | 'archived' | undefined

  const redis = getRedis(c)
  const cacheKey = campaignListKey(userId, page, limit, status)

  if (redis) {
    const cached = await redis.get<CampaignListResult>(cacheKey)
    if (cached) {
      return c.json({
        success: true,
        data: cached.campaigns,
        meta: { page, limit, total: cached.total, hasMore: page * limit < cached.total },
      })
    }
  }

  const db = createDb(c.env.DATABASE_URL)
  const filters = { page, limit, ...(status !== undefined ? { status } : {}) }
  const result = await campaignService.listCampaigns(db, userId, filters)

  if (result.isErr()) {
    return c.json({ success: false, error: result.error.toJSON() }, result.error.statusCode as 500)
  }

  const { campaigns, total } = result.value
  if (redis) {
    await redis.set(cacheKey, result.value, { ex: CAMPAIGN_LIST_TTL })
  }

  return c.json({
    success: true,
    data: campaigns,
    meta: { page, limit, total, hasMore: page * limit < total },
  })
}

export async function createCampaign(c: Context<Env>) {
  const userId = c.get('userId')
  const input = c.req.valid('json' as never)

  const db = createDb(c.env.DATABASE_URL)
  const result = await campaignService.createCampaign(db, userId, input as Parameters<typeof campaignService.createCampaign>[2])

  if (result.isErr()) {
    return c.json({ success: false, error: result.error.toJSON() }, result.error.statusCode as 500)
  }

  await invalidateCampaignCache(getRedis(c), userId)
  return c.json({ success: true, data: result.value }, 201)
}

export async function getCampaign(c: Context<Env>) {
  const userId = c.get('userId')
  const id = c.req.param('id')!

  const db = createDb(c.env.DATABASE_URL)
  const result = await campaignService.getCampaignById(db, userId, id)

  if (result.isErr()) {
    return c.json({ success: false, error: result.error.toJSON() }, result.error.statusCode as 404 | 403)
  }

  return c.json({ success: true, data: result.value })
}

export async function updateCampaign(c: Context<Env>) {
  const userId = c.get('userId')
  const id = c.req.param('id')!
  const input = c.req.valid('json' as never)

  const db = createDb(c.env.DATABASE_URL)
  const result = await campaignService.updateCampaign(db, userId, id, input as Parameters<typeof campaignService.updateCampaign>[3])

  if (result.isErr()) {
    return c.json({ success: false, error: result.error.toJSON() }, result.error.statusCode as 404 | 403 | 500)
  }

  await invalidateCampaignCache(getRedis(c), userId)
  return c.json({ success: true, data: result.value })
}

export async function patchCampaignStatus(c: Context<Env>) {
  const userId = c.get('userId')
  const id = c.req.param('id')!
  const { status } = c.req.valid('json' as never) as { status: 'active' | 'paused' }

  const db = createDb(c.env.DATABASE_URL)
  const result = await campaignService.patchCampaignStatus(db, userId, id, status)

  if (result.isErr()) {
    return c.json({ success: false, error: result.error.toJSON() }, result.error.statusCode as 404 | 403 | 500)
  }

  await invalidateCampaignCache(getRedis(c), userId)
  return c.json({ success: true, data: result.value })
}

export async function deleteCampaign(c: Context<Env>) {
  const userId = c.get('userId')
  const id = c.req.param('id')!

  const db = createDb(c.env.DATABASE_URL)
  const result = await campaignService.deleteCampaign(db, userId, id)

  if (result.isErr()) {
    return c.json({ success: false, error: result.error.toJSON() }, result.error.statusCode as 404 | 403 | 500)
  }

  await invalidateCampaignCache(getRedis(c), userId)
  return c.json({ success: true, data: null }, 200)
}

export async function getCampaignAnalytics(c: Context<Env>) {
  const userId = c.get('userId')
  const id = c.req.param('id')!

  const redis = getRedis(c)
  const cacheKey = analyticsKey(userId, id)

  if (redis) {
    const cached = await redis.get<object>(cacheKey)
    if (cached) {
      return c.json({ success: true, data: cached })
    }
  }

  const db = createDb(c.env.DATABASE_URL)
  const result = await campaignService.getCampaignById(db, userId, id)

  if (result.isErr()) {
    return c.json({ success: false, error: result.error.toJSON() }, result.error.statusCode as 404 | 403)
  }

  // Analytics are computed in Sprint 6 — stub for now
  const analyticsData = {
    campaignId: id,
    totalLeads: 0,
    hotLeads: 0,
    warmLeads: 0,
    enrichedLeads: 0,
    crmSyncedLeads: 0,
  }

  if (redis) {
    await redis.set(cacheKey, analyticsData, { ex: ANALYTICS_TTL })
  }

  return c.json({ success: true, data: analyticsData })
}
