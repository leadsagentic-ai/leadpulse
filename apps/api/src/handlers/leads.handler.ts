import type { Context } from 'hono'
import { createDb } from '@/db'
import * as leadService from '@/services/lead.service'

type Env = {
  Bindings: { DATABASE_URL: string }
  Variables: { userId: string }
}

export async function listLeads(c: Context<Env>) {
  const userId = c.get('userId')
  const page       = Number(c.req.query('page')       ?? 1)
  const limit      = Math.min(Number(c.req.query('limit') ?? 20), 100)
  const campaignId = c.req.query('campaignId')
  const platform   = c.req.query('platform')
  const status     = c.req.query('status') as 'pending' | 'approved' | 'discarded' | 'pushed_crm' | undefined

  const db = createDb(c.env.DATABASE_URL)
  const filters = {
    page,
    limit,
    ...(campaignId             ? { campaignId } : {}),
    ...(platform               ? { platform }   : {}),
    ...(status !== undefined   ? { status }      : {}),
  }
  const result = await leadService.listLeads(db, userId, filters)

  if (result.isErr()) {
    return c.json({ success: false, error: result.error.toJSON() }, result.error.statusCode as 500)
  }

  const { leads, total } = result.value
  return c.json({
    success: true,
    data: leads,
    meta: { page, limit, total, hasMore: page * limit < total },
  })
}

export async function getLead(c: Context<Env>) {
  const userId = c.get('userId')
  const id = c.req.param('id')!

  const db = createDb(c.env.DATABASE_URL)
  const result = await leadService.getLeadById(db, userId, id)

  if (result.isErr()) {
    return c.json({ success: false, error: result.error.toJSON() }, result.error.statusCode as 404 | 403)
  }

  return c.json({ success: true, data: result.value })
}

export async function patchLeadStatus(c: Context<Env>) {
  const userId = c.get('userId')
  const id = c.req.param('id')!
  const { status } = c.req.valid('json' as never) as { status: 'approved' | 'discarded' | 'pushed_crm' }

  const db = createDb(c.env.DATABASE_URL)
  const result = await leadService.patchLeadStatus(db, userId, id, status)

  if (result.isErr()) {
    return c.json({ success: false, error: result.error.toJSON() }, result.error.statusCode as 404 | 403 | 500)
  }

  return c.json({ success: true, data: result.value })
}
