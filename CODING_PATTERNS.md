# CODING_PATTERNS.md — LeadPulse Intelligence Platform
## Every Code Pattern the Agent Must Follow — With Working Examples
## Version: 1.0 | March 2026

---

> **AGENT INSTRUCTION:** This file contains the exact patterns for every type of code
> you will write on this project. Copy these patterns. Do not invent alternatives.
> All examples here are production-ready and match the LeadPulse stack exactly.

---

## PATTERN 1: neverthrow Result — The Core Pattern

**Rule:** Every service function returns `Result<SuccessType, AppError>`. Services NEVER throw.
Handlers pattern-match the result. This makes errors explicit and impossible to ignore.

```typescript
// apps/api/src/lib/errors.ts
import { err } from 'neverthrow'

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
  toJSON() {
    return { code: this.code, message: this.message, details: this.details }
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 400, details)
  }
}
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404)
  }
}
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401)
  }
}
export class ExternalApiError extends AppError {
  constructor(provider: string, message: string) {
    super('EXTERNAL_API_ERROR', `${provider}: ${message}`, 502)
  }
}
export class RateLimitedError extends AppError {
  constructor(provider: string) {
    super('RATE_LIMITED', `${provider} rate limit exceeded`, 429)
  }
}
export class EnrichmentFailedError extends AppError {
  constructor(leadId: string) {
    super('ENRICHMENT_FAILED', `All enrichment providers failed for lead ${leadId}`, 422)
  }
}
```

```typescript
// CORRECT service pattern — returns Result<T, AppError>
import { ok, err, Result } from 'neverthrow'
import { ExternalApiError, RateLimitedError } from '@/lib/errors'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import ky from 'ky'

export interface HunterEmailResult {
  email: string
  confidence: number
  found: boolean
}

export async function findEmailByDomain(
  domain: string,
): Promise<Result<HunterEmailResult, AppError>> {
  logger.info({ domain, provider: 'hunter.io' }, 'Email enrichment started')

  const response = await ky
    .get('https://api.hunter.io/v2/domain-search', {
      searchParams: { domain, api_key: env.HUNTER_API_KEY },
      timeout: 10_000,
    })
    .json<HunterApiResponse>()
    .catch((e: Error) => {
      if (e.message.includes('429')) throw new RateLimitedError('hunter.io')
      return null
    })

  if (!response) {
    logger.error({ domain, provider: 'hunter.io' }, 'Hunter API request failed')
    return err(new ExternalApiError('hunter.io', 'Domain search request failed'))
  }

  if (!response.data.emails.length) {
    logger.info({ domain }, 'No emails found for domain')
    return ok({ email: '', confidence: 0, found: false })
  }

  const best = response.data.emails.sort((a, b) => b.confidence - a.confidence)[0]
  logger.info({ domain, email: best.value, confidence: best.confidence }, 'Email found')
  return ok({ email: best.value, confidence: best.confidence, found: true })
}
```

```typescript
// CORRECT handler pattern — thin, pattern-matches Result
import type { Context } from 'hono'
import { findEmailByDomain } from '@/services/enrichment/hunter.service'

export async function enrichByDomainHandler(c: Context) {
  const { domain } = c.req.valid('json')             // already validated by zValidator

  const result = await findEmailByDomain(domain)

  if (result.isErr()) {
    const { statusCode, ...error } = result.error
    return c.json({ success: false, error: error.toJSON() }, statusCode as 400 | 502 | 429)
  }

  return c.json({ success: true, data: result.value })
}
```

---

## PATTERN 2: Drizzle ORM Schema — Schema-First, Zero Type Duplication

```typescript
// apps/api/src/db/schema/campaigns.schema.ts
import {
  pgTable, pgEnum, uuid, text, varchar, integer,
  boolean, timestamp, index
} from 'drizzle-orm/pg-core'
import { users } from './users.schema'

// Enums — always define with pgEnum
export const campaignStatusEnum = pgEnum('campaign_status', ['active', 'paused', 'archived'])
export const notificationFreqEnum = pgEnum('notification_freq', ['realtime', 'hourly', 'daily'])

export const campaigns = pgTable(
  'campaigns',
  {
    id:                uuid('id').primaryKey().defaultRandom(),
    userId:            uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name:              varchar('name', { length: 255 }).notNull(),
    keywords:          text('keywords').array().notNull(),
    exclusionKeywords: text('exclusion_keywords').array().default([]).notNull(),
    intentFilters:     text('intent_filters').array().default([]).notNull(),
    platforms:         text('platforms').array().notNull(),
    subredditTargets:  text('subreddit_targets').array().default([]).notNull(),
    language:          varchar('language', { length: 10 }).default('en').notNull(),
    minEngagement:     integer('min_engagement').default(0).notNull(),
    personaFilter:     text('persona_filter'),                    // nullable
    geoFilter:         text('geo_filter').array().default([]).notNull(),
    notificationFreq:  notificationFreqEnum('notification_freq').default('daily').notNull(),
    status:            campaignStatusEnum('status').default('active').notNull(),
    createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Index on userId — most queries filter by user
    userIdIdx: index('campaigns_user_id_idx').on(table.userId),
    // Index on status — filtering active vs paused
    statusIdx: index('campaigns_status_idx').on(table.status),
  }),
)

// Types are INFERRED — never write them manually
export type Campaign    = typeof campaigns.$inferSelect
export type NewCampaign = typeof campaigns.$inferInsert
```

```typescript
// apps/api/src/db/index.ts — Drizzle + Neon client factory
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

// Factory function — creates new connection per Worker request
// (Workers are stateless — no connection pooling needed)
export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl)
  return drizzle(sql, { schema, logger: false })
}

export type Database = ReturnType<typeof createDb>
```

```typescript
// CORRECT Drizzle query patterns
import { eq, and, desc, gte, lte, inArray, count, sql } from 'drizzle-orm'
import { campaigns } from '@/db/schema/campaigns.schema'
import type { Database } from '@/db'

// SELECT with filter + order + pagination
const results = await db
  .select()
  .from(campaigns)
  .where(and(
    eq(campaigns.userId, userId),
    eq(campaigns.status, 'active'),
  ))
  .orderBy(desc(campaigns.createdAt))
  .limit(20)
  .offset((page - 1) * 20)

// INSERT
const [created] = await db
  .insert(campaigns)
  .values({ ...newCampaignData, userId })
  .returning()

// UPDATE
const [updated] = await db
  .update(campaigns)
  .set({ status: 'paused', updatedAt: new Date() })
  .where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)))
  .returning()

// DELETE (soft delete via status update)
await db
  .update(campaigns)
  .set({ status: 'archived' })
  .where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)))

// COUNT
const [{ value }] = await db
  .select({ value: count() })
  .from(campaigns)
  .where(eq(campaigns.userId, userId))
```

---

## PATTERN 3: Hono Routes — Type-Safe with zValidator

```typescript
// apps/api/src/routes/campaigns.routes.ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '@/middleware/auth.middleware'
import { rateLimitMiddleware } from '@/middleware/rate-limit.middleware'
import * as handler from '@/handlers/campaigns.handler'

// Zod schemas — define once, infer TypeScript types
const CreateCampaignSchema = z.object({
  name:              z.string().min(1).max(255),
  keywords:          z.array(z.string().min(1)).min(1).max(20),
  exclusionKeywords: z.array(z.string()).default([]),
  intentFilters:     z.array(z.enum([
    'BUYING_INTENT', 'PAIN_SIGNAL', 'COMPARISON_INTENT', 'HIRING_INTENT', 'ANNOUNCEMENT_INTENT'
  ])).default([]),
  platforms: z.array(z.enum(['reddit', 'bluesky', 'threads', 'mastodon', 'github', 'linkedin', 'naukri', 'x'])).min(1),
  personaFilter:     z.string().max(500).optional(),
  geoFilter:         z.array(z.string().length(2)).default([]),  // ISO country codes
  notificationFreq:  z.enum(['realtime', 'hourly', 'daily']).default('daily'),
})

const PatchCampaignStatusSchema = z.object({
  status: z.enum(['active', 'paused']),
})

// Type inferences — used in handlers
export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>
export type PatchCampaignStatusInput = z.infer<typeof PatchCampaignStatusSchema>

// Route group — all protected
export const campaignRoutes = new Hono()
  .use('*', authMiddleware)
  .use('*', rateLimitMiddleware({ limit: 100, window: 60 }))
  .get('/',                          handler.listCampaigns)
  .post('/',                         zValidator('json', CreateCampaignSchema),     handler.createCampaign)
  .get('/:id',                       handler.getCampaign)
  .put('/:id',                       zValidator('json', CreateCampaignSchema),     handler.updateCampaign)
  .patch('/:id/status',              zValidator('json', PatchCampaignStatusSchema), handler.patchCampaignStatus)
  .delete('/:id',                    handler.deleteCampaign)
  .get('/:id/analytics',             handler.getCampaignAnalytics)
```

```typescript
// apps/api/src/index.ts — Hono app entry point
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { logger as honoLogger } from 'hono/logger'
import { campaignRoutes } from '@/routes/campaigns.routes'
import { leadsRoutes } from '@/routes/leads.routes'
import { integrationsRoutes } from '@/routes/integrations.routes'
import type { Env } from '@/lib/env'

// Hono type — extends Cloudflare Env bindings
type HonoEnv = {
  Bindings: Env & {
    SIGNAL_QUEUE: Queue
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
app.use('*', cors({ origin: (origin) => origin, credentials: true }))
app.use('*', honoLogger())

// Health check — unauthenticated
app.get('/health', async (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API routes
app.route('/api/v1/campaigns',    campaignRoutes)
app.route('/api/v1/leads',        leadsRoutes)
app.route('/api/v1/integrations', integrationsRoutes)

// 404 handler
app.notFound((c) => c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404))

// Error handler
app.onError((err, c) => {
  logger.error({ err }, 'Unhandled error')
  return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500)
})

export default app
```

---

## PATTERN 4: Auth Middleware — Firebase JWT Verification

```typescript
// apps/api/src/middleware/auth.middleware.ts
import { createMiddleware } from 'hono/factory'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

// Firebase JWT verification via REST API (works in Cloudflare Workers)
// The full Firebase Admin SDK requires Node.js — doesn't work in Workers
export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' } }, 401)
  }

  const token = authHeader.slice(7)

  // Verify token via Firebase REST API
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    }
  )

  if (!response.ok) {
    logger.warn({ status: response.status }, 'Firebase token verification failed')
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } }, 401)
  }

  const data = await response.json<{ users: Array<{ localId: string; email: string }> }>()

  if (!data.users?.length) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not found' } }, 401)
  }

  // Set on Hono context — available in all handlers via c.get('userId')
  c.set('userId', data.users[0].localId)
  c.set('userEmail', data.users[0].email)

  await next()
})
```

---

## PATTERN 5: Env Validation — Fail Fast on Startup

```typescript
// apps/api/src/lib/env.ts
import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
  server: {
    DATABASE_URL:          z.string().url(),
    UPSTASH_REDIS_REST_URL:   z.string().url(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(20),
    FIREBASE_WEB_API_KEY:  z.string().min(10),
    ML_SERVICE_URL:        z.string().url(),
    ML_SERVICE_SECRET:     z.string().min(20),
    HUNTER_API_KEY:        z.string().min(10),
    ANTHROPIC_API_KEY:     z.string().startsWith('sk-ant-'),
    RESEND_API_KEY:        z.string().startsWith('re_'),
    RAZORPAY_KEY_ID:       z.string().startsWith('rzp_'),
    RAZORPAY_KEY_SECRET:   z.string().min(10),
    FRONTEND_URL:          z.string().url(),
    ENCRYPTION_KEY:        z.string().length(32),
    NODE_ENV:              z.enum(['development', 'test', 'production']).default('development'),
  },
  // In Cloudflare Workers, env vars come from Worker bindings — not process.env
  // The createEnv will be called with the Worker env in index.ts
  runtimeEnv: typeof process !== 'undefined' ? process.env : {},
  skipValidation: false,
  emptyStringAsUndefined: true,
})

export type Env = typeof env
```

---

## PATTERN 6: Pino Logging — Structured JSON

```typescript
// apps/api/src/lib/logger.ts
import pino from 'pino'
import { env } from '@/lib/env'

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  base: { service: 'leadpulse-api' },
  // In Cloudflare Workers, pino outputs to console automatically
})

// CORRECT — context object FIRST, message string SECOND
logger.info({ leadId, provider: 'hunter.io', domain }, 'Enrichment started')
logger.info({ userId, campaignId, platform: 'reddit' }, 'Signal poll scheduled')
logger.warn({ leadId, attempt: 3, maxRetries: 3 }, 'Enrichment max retries reached')
logger.error({ err, leadId, provider: 'hunter.io' }, 'Enrichment failed')

// WRONG — never do these
console.log(`Enrichment started for ${leadId}`)          // ❌ BANNED
logger.info(`Processing lead ${leadId}`)                   // ❌ WRONG format
logger.info({ message: 'started', leadId: leadId })       // ❌ WRONG — message is second param
```

---

## PATTERN 7: Cloudflare Queue Consumer

```typescript
// apps/api/src/queues/signal-processing.queue.ts
import type { MessageBatch, Message } from '@cloudflare/workers-types'
import { createDb } from '@/db'
import { classifyIntent } from '@/services/intent/intent-orchestrator.service'
import { createLead } from '@/services/leads.service'
import { logger } from '@/lib/logger'

// Type the queue message payload
interface SignalProcessingMessage {
  rawSignalId: string
  campaignId: string
  userId: string
  platform: 'reddit' | 'bluesky' | 'threads' | 'mastodon'
  postText: string
  postUrl: string
  authorUsername: string
  postPublishedAt: string
}

// Queue consumer — called automatically by Cloudflare Workers runtime
export async function handleSignalQueue(
  batch: MessageBatch<SignalProcessingMessage>,
  env: Env,
): Promise<void> {
  const db = createDb(env.DATABASE_URL)

  for (const message of batch.messages) {
    const data = message.body
    logger.info({ rawSignalId: data.rawSignalId, platform: data.platform }, 'Processing signal')

    try {
      // Classify intent via ML service
      const intentResult = await classifyIntent(data.postText, env)

      if (intentResult.isErr()) {
        logger.error({ err: intentResult.error, rawSignalId: data.rawSignalId }, 'Intent classification failed')
        message.retry()      // Cloudflare will retry this message
        continue
      }

      // If intent is too weak, discard
      if (intentResult.value.confidence < 0.6) {
        logger.info({ rawSignalId: data.rawSignalId, confidence: intentResult.value.confidence }, 'Low confidence — discarding')
        message.ack()
        continue
      }

      // Create lead record
      const leadResult = await createLead(db, { ...data, intent: intentResult.value })

      if (leadResult.isErr()) {
        logger.error({ err: leadResult.error }, 'Lead creation failed')
        message.retry()
        continue
      }

      // Queue enrichment
      await env.ENRICHMENT_QUEUE.send({ leadId: leadResult.value.id, userId: data.userId })

      message.ack()
      logger.info({ leadId: leadResult.value.id }, 'Signal processed successfully')

    } catch (e) {
      logger.error({ err: e, rawSignalId: data.rawSignalId }, 'Unexpected error in signal queue')
      message.retry()
    }
  }
}
```

---

## PATTERN 8: React 19 — Suspense-First Data Fetching

```typescript
// apps/web/src/lib/queries/leads.queries.ts
import { queryOptions } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { Lead, LeadFilters } from '@leadpulse/shared-types'

// queryOptions factory — co-locate with queries file, not component
export const leadsQueryOptions = (filters: LeadFilters) =>
  queryOptions({
    queryKey: ['leads', filters] as const,
    queryFn:  () => apiClient.leads.list(filters),
    staleTime: 30_000,      // 30 seconds
    gcTime:    5 * 60_000,  // 5 minutes
  })

export const leadDetailQueryOptions = (leadId: string) =>
  queryOptions({
    queryKey: ['leads', leadId] as const,
    queryFn:  () => apiClient.leads.get(leadId),
    staleTime: 60_000,
  })
```

```tsx
// apps/web/src/components/leads/LeadFeed.tsx
import { Suspense } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ErrorBoundary } from 'react-error-boundary'
import { leadsQueryOptions } from '@/lib/queries/leads.queries'
import { LeadCard } from './LeadCard'
import { LeadFeedSkeleton } from '@/components/shared/Skeletons'
import type { LeadFilters } from '@leadpulse/shared-types'

// Inner component — uses useSuspenseQuery (suspends while loading)
function LeadFeedInner({ filters }: { filters: LeadFilters }) {
  const { data } = useSuspenseQuery(leadsQueryOptions(filters))  // no isLoading needed

  if (!data.leads.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-sm">No leads found for these filters.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {data.leads.map((lead) => (
        <LeadCard key={lead.id} lead={lead} />
      ))}
    </div>
  )
}

// Outer component — wraps with Suspense + ErrorBoundary (always)
export function LeadFeed({ filters }: { filters: LeadFilters }) {
  return (
    <ErrorBoundary
      fallback={<div className="p-4 text-destructive text-sm">Failed to load leads. Try refreshing.</div>}
    >
      <Suspense fallback={<LeadFeedSkeleton rows={8} />}>
        <LeadFeedInner filters={filters} />
      </Suspense>
    </ErrorBoundary>
  )
}
```

```typescript
// apps/web/src/lib/auth.ts — Firebase Auth helpers
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  signOut as firebaseSignOut, onAuthStateChanged,
  type User
} from 'firebase/auth'
import { initializeApp } from 'firebase/app'

const app = initializeApp({
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
})

export const auth = getAuth(app)

// Google sign-in
export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider()
  const result = await signInWithPopup(auth, provider)
  return result.user
}

// Get fresh JWT token to send to API
export async function getIdToken(): Promise<string | null> {
  return auth.currentUser?.getIdToken() ?? null
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth)
}
```

---

## PATTERN 9: Python FastAPI — Pydantic v2 + Annotated Dependencies

```python
# apps/ml/src/intent/classifier.py
from typing import Annotated, Literal
from fastapi import Depends
from pydantic import BaseModel, Field, model_validator
import anthropic
import json

# --- Request / Response Models ---

class IntentClassificationRequest(BaseModel):
    model_config = {"strict": True}

    post_text:      str = Field(min_length=1, max_length=10_000)
    author_bio:     str | None = Field(default=None, max_length=2_000)
    persona_filter: str | None = None
    platform:       Literal['reddit', 'bluesky', 'threads', 'mastodon', 'github', 'linkedin']

    @model_validator(mode='after')
    def text_must_be_classifiable(self) -> 'IntentClassificationRequest':
        word_count = len(self.post_text.split())
        if word_count < 5:
            raise ValueError(f'Post text too short for classification: {word_count} words')
        return self


class IntentClassificationResponse(BaseModel):
    intent_type:   Literal['BUYING_INTENT', 'PAIN_SIGNAL', 'COMPARISON_INTENT', 'HIRING_INTENT', 'ANNOUNCEMENT_INTENT']
    confidence:    float = Field(ge=0.0, le=1.0)
    urgency_score: float = Field(ge=0.0, le=1.0)
    justification: str   = Field(min_length=10, max_length=500)
    sentiment:     Literal['POSITIVE', 'NEGATIVE', 'NEUTRAL']


# --- Dependency Injection ---

async def get_anthropic_client() -> anthropic.AsyncAnthropic:
    from main import settings
    return anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

AnthropicDep = Annotated[anthropic.AsyncAnthropic, Depends(get_anthropic_client)]


# --- Classification Function ---

INTENT_SYSTEM_PROMPT = """You are an expert B2B sales signal classifier.
Analyze the given post and classify it into exactly ONE intent type.

Intent types:
- BUYING_INTENT: Person actively evaluating or seeking to purchase a product/service
- PAIN_SIGNAL: Person expressing frustration or failure with an existing solution
- COMPARISON_INTENT: Person comparing options or asking for tool recommendations
- HIRING_INTENT: Company growing/scaling (useful for targeting decision-makers)
- ANNOUNCEMENT_INTENT: Person announcing company news, funding, or launch

Return ONLY valid JSON matching this schema:
{
  "intent_type": "BUYING_INTENT | PAIN_SIGNAL | COMPARISON_INTENT | HIRING_INTENT | ANNOUNCEMENT_INTENT",
  "confidence": 0.0-1.0,
  "urgency_score": 0.0-1.0,
  "justification": "One sentence explaining classification with specific quote from post",
  "sentiment": "POSITIVE | NEGATIVE | NEUTRAL"
}"""


async def classify_post_intent(
    request: IntentClassificationRequest,
    client: AnthropicDep,
) -> IntentClassificationResponse:
    """Classify post intent using Claude Haiku — cost-optimized."""

    user_message = f"""Platform: {request.platform}
Post text: {request.post_text}
Author bio: {request.author_bio or 'Not available'}
Target persona: {request.persona_filter or 'Not specified'}

Classify the intent of this post."""

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",  # Cheapest Claude model
        max_tokens=300,
        system=INTENT_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = message.content[0].text.strip()

    # Parse and validate with Pydantic
    data = json.loads(raw)
    return IntentClassificationResponse(**data)
```

```python
# apps/ml/main.py
from contextlib import asynccontextmanager
from typing import AsyncIterator
from fastapi import FastAPI, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic_settings import BaseSettings
from src.intent.classifier import (
    IntentClassificationRequest, IntentClassificationResponse,
    classify_post_intent, AnthropicDep
)


class Settings(BaseSettings):
    ANTHROPIC_API_KEY: str
    ML_SERVICE_SECRET: str
    PORT: int = 8000

    model_config = {"env_file": ".env"}


settings = Settings()
security = HTTPBearer()


def verify_internal_secret(credentials: HTTPAuthorizationCredentials = Security(security)) -> None:
    """Verify the shared secret from the Cloudflare Workers API."""
    if credentials.credentials != settings.ML_SERVICE_SECRET:
        raise HTTPException(status_code=401, detail="Invalid service secret")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Startup: load spaCy model
    import spacy
    app.state.nlp = spacy.load("en_core_web_trf")
    yield
    # Shutdown: cleanup


app = FastAPI(title="LeadPulse ML Service", lifespan=lifespan)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "leadpulse-ml"}


@app.post("/classify", response_model=IntentClassificationResponse, dependencies=[Security(verify_internal_secret)])
async def classify(
    request: IntentClassificationRequest,
    client: AnthropicDep,
) -> IntentClassificationResponse:
    return await classify_post_intent(request, client)
```

---

## PATTERN 10: Vitest Testing — Arrange-Act-Assert

```typescript
// apps/api/src/services/enrichment/hunter.service.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { findEmailByDomain } from './hunter.service'

// Mock env module
vi.mock('@/lib/env', () => ({
  env: { HUNTER_API_KEY: 'test-api-key' }
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

describe('HunterEnrichmentService', () => {
  describe('findEmailByDomain', () => {

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('returns ok() with highest-confidence email on success', async () => {
      // Arrange
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            emails: [
              { value: 'jane@acme.com', confidence: 72 },
              { value: 'john@acme.com', confidence: 94 },   // should pick this one
            ]
          }
        })
      }))

      // Act
      const result = await findEmailByDomain('acme.com')

      // Assert
      expect(result.isOk()).toBe(true)
      expect(result.unwrap().email).toBe('john@acme.com')
      expect(result.unwrap().confidence).toBe(94)
      expect(result.unwrap().found).toBe(true)
    })

    it('returns ok() with found=false when no emails found', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { emails: [] } })
      }))

      const result = await findEmailByDomain('unknown-domain.com')

      expect(result.isOk()).toBe(true)
      expect(result.unwrap().found).toBe(false)
      expect(result.unwrap().email).toBe('')
    })

    it('returns err(EXTERNAL_API_ERROR) when API request fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

      const result = await findEmailByDomain('acme.com')

      expect(result.isErr()).toBe(true)
      expect(result.unwrapErr().code).toBe('EXTERNAL_API_ERROR')
    })

    it('returns err(RATE_LIMITED) on 429 response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('429 Too Many Requests')))

      const result = await findEmailByDomain('acme.com')

      expect(result.isErr()).toBe(true)
      expect(result.unwrapErr().code).toBe('RATE_LIMITED')
    })
  })
})
```

---

## PATTERN 11: Shared Types — Zod-First

```typescript
// packages/shared-types/src/lead.ts
import { z } from 'zod'

export const PlatformEnum = z.enum(['reddit', 'bluesky', 'linkedin', 'threads', 'mastodon', 'github', 'naukri', 'x'])
export const IntentTypeEnum = z.enum(['BUYING_INTENT', 'PAIN_SIGNAL', 'COMPARISON_INTENT', 'HIRING_INTENT', 'ANNOUNCEMENT_INTENT'])
export const ScoreTierEnum = z.enum(['HOT', 'WARM', 'COOL', 'WEAK', 'DISCARD'])
export const EmailStatusEnum = z.enum(['VALID', 'INVALID', 'RISKY', 'UNKNOWN'])
export const LeadStatusEnum = z.enum(['pending', 'approved', 'discarded', 'pushed_crm'])

export const LeadSchema = z.object({
  id:                    z.string().uuid(),
  campaignId:            z.string().uuid(),
  userId:                z.string(),
  platform:              PlatformEnum,
  postUrl:               z.string().url(),
  postText:              z.string(),
  postPublishedAt:       z.string().datetime(),
  postEngagement:        z.number().int().min(0),
  intentType:            IntentTypeEnum,
  intentConfidence:      z.number().min(0).max(1),
  intentJustification:   z.string(),
  urgencyScore:          z.number().min(0).max(1),
  name:                  z.string().nullable(),
  username:              z.string(),
  platformProfileUrl:    z.string().url(),
  jobTitle:              z.string().nullable(),
  company:               z.string().nullable(),
  companyDomain:         z.string().nullable(),
  location:              z.string().nullable(),
  email:                 z.string().email().nullable(),
  emailStatus:           EmailStatusEnum.nullable(),
  phone:                 z.string().nullable(),
  linkedinUrl:           z.string().url().nullable(),
  leadScore:             z.number().int().min(0).max(100),
  scoreTier:             ScoreTierEnum,
  status:                LeadStatusEnum,
  complianceGdprSafe:    z.boolean(),
  complianceDpdpSafe:    z.boolean(),
  createdAt:             z.string().datetime(),
  enrichedAt:            z.string().datetime().nullable(),
})

// TypeScript type — ONLY ever inferred, never written manually
export type Lead = z.infer<typeof LeadSchema>

// List response schema
export const LeadListSchema = z.object({
  leads:   z.array(LeadSchema),
  total:   z.number(),
  page:    z.number(),
  limit:   z.number(),
  hasMore: z.boolean(),
})
export type LeadList = z.infer<typeof LeadListSchema>

// Filters schema
export const LeadFiltersSchema = z.object({
  page:          z.number().int().min(1).default(1),
  limit:         z.number().int().min(1).max(100).default(20),
  platform:      PlatformEnum.optional(),
  intentType:    IntentTypeEnum.optional(),
  scoreTier:     ScoreTierEnum.optional(),
  minScore:      z.number().int().min(0).max(100).optional(),
  maxScore:      z.number().int().min(0).max(100).optional(),
  status:        LeadStatusEnum.optional(),
  campaignId:    z.string().uuid().optional(),
  emailStatus:   EmailStatusEnum.optional(),
  dateFrom:      z.string().datetime().optional(),
  dateTo:        z.string().datetime().optional(),
})
export type LeadFilters = z.infer<typeof LeadFiltersSchema>
```

---

## PATTERN 12: TypeScript Advanced Types (Future-Forward)

```typescript
// Use satisfies for type narrowing without widening
const PLATFORM_CONFIG = {
  reddit:   { pollIntervalSecs: 1800, rateLimit: 60,  requires_auth: true  },
  bluesky:  { pollIntervalSecs:  900, rateLimit: 300, requires_auth: false },
  threads:  { pollIntervalSecs: 1800, rateLimit: 120, requires_auth: true  },
  mastodon: { pollIntervalSecs: 1200, rateLimit: 200, requires_auth: false },
} satisfies Record<string, { pollIntervalSecs: number; rateLimit: number; requires_auth: boolean }>

// Template literal types for events
type LeadEvent     = `lead.${'created' | 'scored' | 'enriched' | 'pushed_crm' | 'discarded'}`
type CampaignEvent = `campaign.${'created' | 'activated' | 'paused' | 'deleted'}`

// Discriminated unions for state machines
type EnrichmentState =
  | { status: 'pending' }
  | { status: 'running';  startedAt: Date; provider: string }
  | { status: 'complete'; completedAt: Date; cost: number; providersUsed: string[] }
  | { status: 'failed';   error: string; attempts: number }

// Named constants — zero magic numbers
const LEAD_SCORE = {
  HOT_THRESHOLD:    80,
  WARM_THRESHOLD:   60,
  COOL_THRESHOLD:   40,
  WEAK_THRESHOLD:   20,
} as const

const ENRICHMENT = {
  MAX_RETRIES:      3,
  TIMEOUT_MS:       30_000,
  WATERFALL_STEPS:  ['hunter', 'apollo', 'pdl', 'clearbit', 'lusha'] as const,
} as const
```
