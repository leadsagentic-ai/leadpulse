import type { Context } from 'hono'
import { createDb } from '@/db'
import * as campaignService from '@/services/campaign.service'

type Env = {
  Bindings: { DATABASE_URL: string }
  Variables: { userId: string }
}

export async function listCampaigns(c: Context<Env>) {
  const userId = c.get('userId')
  const page = Number(c.req.query('page') ?? 1)
  const limit = Number(c.req.query('limit') ?? 20)
  const status = c.req.query('status') as 'active' | 'paused' | 'archived' | undefined

  const db = createDb(c.env.DATABASE_URL)
  const filters = { page, limit, ...(status !== undefined ? { status } : {}) }
  const result = await campaignService.listCampaigns(db, userId, filters)

  if (result.isErr()) {
    return c.json({ success: false, error: result.error.toJSON() }, result.error.statusCode as 500)
  }

  const { campaigns, total } = result.value
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

  return c.json({ success: true, data: null }, 200)
}

export async function getCampaignAnalytics(c: Context<Env>) {
  const userId = c.get('userId')
  const id = c.req.param('id')!

  const db = createDb(c.env.DATABASE_URL)
  const result = await campaignService.getCampaignById(db, userId, id)

  if (result.isErr()) {
    return c.json({ success: false, error: result.error.toJSON() }, result.error.statusCode as 404 | 403)
  }

  // Analytics are computed in Sprint 6 — stub for now
  return c.json({
    success: true,
    data: {
      campaignId: id,
      totalLeads: 0,
      hotLeads: 0,
      warmLeads: 0,
      enrichedLeads: 0,
      crmSyncedLeads: 0,
    },
  })
}
