import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '@/middleware/auth.middleware'
import { rateLimitMiddleware } from '@/middleware/rate-limit.middleware'
import * as handler from '@/handlers/leads.handler'

const PatchLeadStatusSchema = z.object({
  status: z.enum(['approved', 'discarded', 'pushed_crm']),
})

export const leadsRoutes = new Hono()
  .use('*', authMiddleware)
  .use('*', rateLimitMiddleware({ limit: 100, window: 60 }))
  .get('/',        handler.listLeads)
  .get('/:id',     handler.getLead)
  .patch('/:id/status', zValidator('json', PatchLeadStatusSchema), handler.patchLeadStatus)
