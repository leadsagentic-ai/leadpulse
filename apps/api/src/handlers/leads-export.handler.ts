import type { Context } from 'hono'
import { createDb } from '@/db'
import * as leadService from '@/services/lead.service'

type Env = {
  Bindings: { DATABASE_URL: string; STORAGE: R2Bucket }
  Variables: { userId: string }
}

const CSV_HEADERS = [
  'id', 'platform', 'username', 'name', 'email', 'phone', 'linkedinUrl',
  'company', 'companyDomain', 'jobTitle', 'location', 'industry', 'companySize',
  'intentType', 'intentConfidence', 'urgencyScore', 'leadScore', 'scoreTier',
  'status', 'postUrl', 'postText', 'postPublishedAt', 'complianceGdprSafe',
  'complianceDpdpSafe', 'campaignId', 'createdAt',
] as const

function escapeCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildCsv(rows: Record<string, unknown>[]): string {
  const header = CSV_HEADERS.join(',')
  const lines = rows.map((row) =>
    CSV_HEADERS.map((col) => escapeCell(row[col])).join(','),
  )
  return [header, ...lines].join('\n')
}

export async function exportLeads(c: Context<Env>) {
  const userId = c.get('userId')
  const campaignId = c.req.query('campaignId')
  const platform   = c.req.query('platform')
  const status     = c.req.query('status') as 'pending' | 'approved' | 'discarded' | 'pushed_crm' | undefined

  const db = createDb(c.env.DATABASE_URL)
  const result = await leadService.listLeads(db, userId, {
    page:  1,
    limit: 10_000,
    ...(campaignId ? { campaignId } : {}),
    ...(platform   ? { platform }   : {}),
    ...(status     ? { status }     : {}),
  })

  if (result.isErr()) {
    return c.json({ success: false, error: result.error.toJSON() }, result.error.statusCode as 500)
  }

  const csv = buildCsv(result.value.leads as unknown as Record<string, unknown>[])
  const timestamp = Date.now()
  const key = `${userId}/export-${timestamp}.csv`

  await c.env.STORAGE.put(key, csv, {
    httpMetadata: { contentType: 'text/csv' },
    customMetadata: { userId },
  })

  const expiresAt = new Date(timestamp + 24 * 60 * 60 * 1_000).toISOString()
  return c.json({ success: true, data: { key, expiresAt } }, 201)
}

export async function downloadExport(c: Context<Env>) {
  const userId = c.get('userId')
  const key = c.req.param('key')!

  // Security: only allow the user to download their own exports
  if (!key.startsWith(`${userId}/`)) {
    return c.json({ success: false, error: 'Forbidden' }, 403)
  }

  const object = await c.env.STORAGE.get(key)
  if (!object) {
    return c.json({ success: false, error: 'Export not found or expired' }, 404)
  }

  const filename = key.split('/').pop() ?? 'export.csv'
  c.header('Content-Type', 'text/csv')
  c.header('Content-Disposition', `attachment; filename="${filename}"`)
  return c.body(object.body as unknown as ReadableStream)
}
