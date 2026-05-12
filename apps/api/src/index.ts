import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { logger as honoLogger } from 'hono/logger'
import * as Sentry from '@sentry/cloudflare'
import { logger } from '@/lib/logger'
import { validateWorkerEnv } from '@/lib/env'
import { campaignRoutes } from '@/routes/campaigns.routes'
import { authRoutes } from '@/routes/auth.routes'
import { leadsRoutes } from '@/routes/leads.routes'
import { runSignalPoller } from '@/scheduled/signal-poller'
import { handleSignalQueue, type SignalProcessingMessage } from '@/queues/signal-processing.queue'
import { handleEnrichmentQueue, type EnrichmentMessage } from '@/queues/enrichment.queue'

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
    SENTRY_DSN: string
    APOLLO_API_KEY: string
    PDL_API_KEY: string
    PROXYCURL_API_KEY: string
    SIGNAL_QUEUE: Queue<SignalProcessingMessage>
    ENRICHMENT_QUEUE: Queue
    CRM_SYNC_QUEUE: Queue
    STORAGE: R2Bucket
  }
  Variables: {
    userId: string
    userEmail: string
    requestId: string
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

// Attach a unique request ID to every request (used in error responses for support)
app.use('*', (c, next) => {
  c.set('requestId', crypto.randomUUID())
  return next()
})

// Validate CF Worker bindings on startup (env vars live in c.env, not process.env)
app.use('*', (c, next) => {
  validateWorkerEnv(c.env as unknown as Record<string, string | undefined>)
  return next()
})

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
  const requestId = c.get('requestId') ?? crypto.randomUUID()
  logger.error({ err, requestId }, 'Unhandled error')
  return c.json(
    { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } },
    500,
  )
})

// Named export of the bare Hono app — used by integration tests (avoids Sentry wrapper complexity in test env)
export { app }

// Cloudflare Workers exports — fetch (HTTP), scheduled (cron), queue (queue consumer)
// Wrapped with Sentry for automatic error + performance instrumentation
export default Sentry.withSentry(
  (env: HonoEnv['Bindings']) => ({
    dsn: env.SENTRY_DSN ?? '',
    tracesSampleRate: 0.1,
    environment: env.NODE_ENV ?? 'development',
  }),
  {
    fetch: app.fetch,
    async scheduled(event: ScheduledController, env: HonoEnv['Bindings'], ctx: ExecutionContext) {
      ctx.waitUntil(runSignalPoller(event, env))
    },
    async queue(
      batch: MessageBatch,
      env: HonoEnv['Bindings'],
    ) {
      if (batch.queue === 'leadpulse-signal-processing') {
        await handleSignalQueue(batch as MessageBatch<SignalProcessingMessage>, env)
      } else if (batch.queue === 'leadpulse-enrichment') {
        await handleEnrichmentQueue(batch as MessageBatch<EnrichmentMessage>, env)
      }
    },
  },
)
