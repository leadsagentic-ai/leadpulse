import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { logger as honoLogger } from 'hono/logger'
import { logger } from '@/lib/logger'
import { campaignRoutes } from '@/routes/campaigns.routes'
import { authRoutes } from '@/routes/auth.routes'
import { leadsRoutes } from '@/routes/leads.routes'
import { runSignalPoller } from '@/scheduled/signal-poller'
import { handleSignalQueue, type SignalProcessingMessage } from '@/queues/signal-processing.queue'

type HonoEnv = {
  Bindings: {
    DATABASE_URL: string
    UPSTASH_REDIS_REST_URL: string
    UPSTASH_REDIS_REST_TOKEN: string
    FIREBASE_WEB_API_KEY: string
    ML_SERVICE_URL: string
    ML_SERVICE_SECRET: string
    HUNTER_API_KEY: string
    RESEND_API_KEY: string
    RAZORPAY_KEY_ID: string
    RAZORPAY_KEY_SECRET: string
    FRONTEND_URL: string
    ENCRYPTION_KEY: string
    NODE_ENV: string
    REDDIT_CLIENT_ID: string
    REDDIT_CLIENT_SECRET: string
    REDDIT_USER_AGENT: string
    THREADS_ACCESS_TOKEN: string
    SIGNAL_QUEUE: Queue<SignalProcessingMessage>
    ENRICHMENT_QUEUE: Queue
    CRM_SYNC_QUEUE: Queue
    STORAGE: R2Bucket
  }
  Variables: {
    userId: string
    userEmail: string
  }
}

const app = new Hono<HonoEnv>()

// Global middleware
app.use('*', secureHeaders())
app.use('*', cors({
  origin: (origin) => origin,
  credentials: true,
}))
app.use('*', honoLogger())

// Health check — unauthenticated
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API routes
app.route('/api/v1/auth',      authRoutes)
app.route('/api/v1/campaigns', campaignRoutes)
app.route('/api/v1/leads',     leadsRoutes)

// 404 handler
app.notFound((c) =>
  c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404),
)

// Error handler
app.onError((err, c) => {
  logger.error({ err }, 'Unhandled error')
  return c.json(
    { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
    500,
  )
})

// Cloudflare Workers exports — fetch (HTTP), scheduled (cron), queue (queue consumer)
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: HonoEnv['Bindings'], ctx: ExecutionContext) {
    ctx.waitUntil(runSignalPoller(event, env))
  },
  async queue(
    batch: MessageBatch<SignalProcessingMessage>,
    env: HonoEnv['Bindings'],
  ) {
    await handleSignalQueue(batch, env)
  },
}
