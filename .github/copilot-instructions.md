# GitHub Copilot Instructions — LeadPulse Intelligence Platform
# Place this file at: .github/copilot-instructions.md
# Copilot reads this AUTOMATICALLY for every suggestion, chat, and agent task.
# Version: 3.0 | March 2026 | Claude Sonnet 4.6 Optimized

---

## WHAT THIS PROJECT IS

LeadPulse Intelligence is a production-grade, intent-based B2B lead generation SaaS.
It monitors 8 social platforms (Reddit, Bluesky, Threads, Mastodon, GitHub, LinkedIn, Naukri, X),
uses Claude AI to classify buying intent in posts, enriches leads through a waterfall of data
providers, verifies contact data, scores leads 0-100, and routes HOT leads to CRM tools
automatically.

Architecture: Turborepo monorepo — 3 apps + 2 packages.
- apps/api   → Cloudflare Workers + Hono v4 (TypeScript REST API)
- apps/ml    → EC2 t3.micro + FastAPI 0.115 (Python 3.13 ML service)
- apps/web   → Vercel + React 19 + TanStack Router (Dashboard UI)
- packages/shared-types  → Zod schemas + inferred TypeScript types
- packages/shared-utils  → Pure utility functions

Write at Staff-Engineer level. Production-ready on day one. No shortcuts.

---

## CANONICAL TECH STACK — March 2026

### apps/api — Cloudflare Workers

| Concern | Library | Version | Non-Negotiable Rule |
|---------|---------|---------|-------------------|
| Runtime | Cloudflare Workers | latest | Edge-native. NEVER suggest EC2 for the API. |
| Framework | Hono | 4.x | NEVER Express. NEVER Fastify. |
| Language | TypeScript | 5.7.x | strict: true. No `any` without comment. |
| Validation | Zod | 3.24.x | z.infer<> everywhere. NEVER write types manually. |
| ORM | Drizzle ORM | 0.38.x | NEVER TypeORM. NEVER Prisma. |
| DB Driver | @neondatabase/serverless | 0.10.x | HTTP mode. Required for Workers. |
| Migrations | drizzle-kit | 0.29.x | pnpm db:generate → pnpm db:migrate |
| Queue | Cloudflare Queues | built-in | NEVER BullMQ (requires TCP, fails in Workers). |
| Auth | Firebase Auth REST | — | Verify JWT via Firebase REST API. NEVER Auth0. |
| HTTP Client | ky | 1.x | NEVER axios. NEVER node-fetch. |
| Logging | Pino | 9.x | NEVER console.log. NEVER Winston. |
| Errors | neverthrow | 8.x | Result<T,E> pattern. Services NEVER throw. |
| Testing | Vitest | 2.x | NEVER Jest. Co-located .test.ts files. |
| Env | @t3-oss/env-core | 0.11.x | Zod-validated. Fail-fast on startup. |
| Cache | @upstash/redis | 1.x | REST client. NEVER ioredis (TCP fails in Workers). |
| Pkg Mgr | pnpm | 9.x | NEVER npm. NEVER yarn. |

### apps/ml — EC2 Python

| Concern | Library | Version | Rule |
|---------|---------|---------|------|
| Runtime | Python | 3.13 | match/case, type aliases |
| Pkg Manager | uv | latest | NEVER pip install. NEVER poetry. Use uv add. |
| Framework | FastAPI | 0.115.x | Annotated[] for all dependencies |
| Validation | Pydantic | v2.10.x | strict mode, model_validator. NEVER v1 patterns. |
| AI SDK | anthropic | 0.40.x | Claude Haiku — NOT Claude Sonnet (10x cheaper). |
| NLP | spaCy | 3.8.x | Transformer pipeline for NER |
| HTTP | httpx | 0.28.x | NEVER requests |
| Testing | pytest + pytest-asyncio | 8.x | All async tests |

### apps/web — Vercel React

| Concern | Library | Version | Rule |
|---------|---------|---------|------|
| Framework | React | 19.x | use(), useOptimistic(), useFormStatus() |
| Language | TypeScript | 5.7.x | strict, satisfies operator aggressively |
| Router | TanStack Router | 1.x | File-based, type-safe routes + search params |
| Data | TanStack Query | 5.x | queryOptions() factory. useSuspenseQuery ALWAYS. |
| State | Zustand | 5.x | UI state ONLY. Server state = TanStack Query. |
| Forms | React Hook Form | 7.x | + Zod resolver always |
| Styling | Tailwind CSS | 4.x | @theme directive. CSS-first config. |
| Components | shadcn/ui | latest | Copy-into-repo. Accessible. |
| Tables | TanStack Table | 8.x | Headless, typed |
| Auth | firebase | 11.x | Firebase Auth client SDK |
| Build | Vite | 6.x | ESM-only |
| Testing | Vitest + RTL | 2.x | Co-located |

---

## MANDATORY CODE PATTERNS

### Pattern 1: neverthrow Result — Services NEVER Throw

```typescript
import { ok, err, Result } from 'neverthrow'
import { ExternalApiError, RateLimitedError } from '@/lib/errors'

// CORRECT — service returns Result<T, AppError>
export async function findEmailByDomain(
  domain: string,
): Promise<Result<{ email: string; confidence: number; found: boolean }, AppError>> {
  const response = await ky
    .get('https://api.hunter.io/v2/domain-search', {
      searchParams: { domain, api_key: env.HUNTER_API_KEY }
    })
    .json<HunterResponse>()
    .catch((e: Error) => {
      if (e.message.includes('429')) throw new RateLimitedError('hunter.io')
      return null
    })

  if (!response) return err(new ExternalApiError('hunter.io', 'request failed'))
  if (!response.data.emails.length) return ok({ email: '', confidence: 0, found: false })
  const best = response.data.emails.sort((a, b) => b.confidence - a.confidence)[0]
  return ok({ email: best.value, confidence: best.confidence, found: true })
}

// CORRECT — handler pattern-matches Result, never catches
export async function enrichHandler(c: Context) {
  const { domain } = c.req.valid('json')
  const result = await findEmailByDomain(domain)
  if (result.isErr()) return c.json({ success: false, error: result.error.toJSON() }, result.error.statusCode as 400 | 502 | 429)
  return c.json({ success: true, data: result.value })
}
```

### Pattern 2: Drizzle Schema — $inferSelect, Never Write Types

```typescript
import { pgTable, pgEnum, uuid, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core'

export const scoreTierEnum = pgEnum('score_tier', ['HOT', 'WARM', 'COOL', 'WEAK', 'DISCARD'])

export const leads = pgTable('leads', {
  id:         uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id),
  leadScore:  integer('lead_score').default(0).notNull(),
  scoreTier:  scoreTierEnum('score_tier').notNull(),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  campaignIdx: index('leads_campaign_id_idx').on(t.campaignId),
  scoreIdx:    index('leads_score_idx').on(t.leadScore),
}))

// Types INFERRED — never written manually
export type Lead    = typeof leads.$inferSelect
export type NewLead = typeof leads.$inferInsert
```

### Pattern 3: Hono Routes — Type-Safe with zValidator

```typescript
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '@/middleware/auth.middleware'
import { z } from 'zod'

const CreateCampaignSchema = z.object({
  name:      z.string().min(1).max(255),
  keywords:  z.array(z.string().min(1)).min(1).max(20),
  platforms: z.array(z.enum(['reddit', 'bluesky', 'threads', 'mastodon'])).min(1),
})

export const campaignRoutes = new Hono()
  .use('*', authMiddleware)
  .get('/',   handler.listCampaigns)
  .post('/',  zValidator('json', CreateCampaignSchema), handler.createCampaign)
  .get('/:id', handler.getCampaign)
```

### Pattern 4: Firebase JWT Auth Middleware (Workers-compatible)

```typescript
import { createMiddleware } from 'hono/factory'
import { env } from '@/lib/env'

export const authMiddleware = createMiddleware(async (c, next) => {
  const token = c.req.header('Authorization')?.slice(7)
  if (!token) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing token' } }, 401)

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_WEB_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }) }
  )
  if (!res.ok) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } }, 401)

  const data = await res.json<{ users: Array<{ localId: string; email: string }> }>()
  c.set('userId', data.users[0].localId)
  c.set('userEmail', data.users[0].email)
  await next()
})
```

### Pattern 5: Pino Logging — Context Object First, Always

```typescript
// CORRECT
logger.info({ leadId, provider: 'hunter.io', domain }, 'Enrichment started')
logger.error({ err, leadId, durationMs: Date.now() - start }, 'Enrichment failed')

// WRONG — never do these
console.log(`Enrichment for ${leadId}`)          // ❌ BANNED
logger.info(`Enrichment started for ${leadId}`)   // ❌ Wrong format
```

### Pattern 6: React 19 — Suspense-First, useSuspenseQuery

```typescript
// queryOptions factory
export const leadsQueryOptions = (filters: LeadFilters) => queryOptions({
  queryKey: ['leads', filters] as const,
  queryFn:  () => apiClient.leads.list(filters),
  staleTime: 30_000,
})

// Component — useSuspenseQuery, no isLoading
function LeadFeedInner({ filters }: { filters: LeadFilters }) {
  const { data } = useSuspenseQuery(leadsQueryOptions(filters))
  return <div>{data.leads.map(l => <LeadCard key={l.id} lead={l} />)}</div>
}

// Always wrap with Suspense + ErrorBoundary
export function LeadFeed({ filters }: { filters: LeadFilters }) {
  return (
    <ErrorBoundary fallback={<div>Failed to load</div>}>
      <Suspense fallback={<LeadFeedSkeleton rows={8} />}>
        <LeadFeedInner filters={filters} />
      </Suspense>
    </ErrorBoundary>
  )
}
```

### Pattern 7: Python FastAPI — Pydantic v2 + Annotated Dependencies

```python
from typing import Annotated, Literal
from fastapi import Depends
from pydantic import BaseModel, Field, model_validator

class IntentRequest(BaseModel):
    model_config = {"strict": True}
    post_text:  str = Field(min_length=5, max_length=10_000)
    platform:   Literal['reddit', 'bluesky', 'threads', 'mastodon', 'github']

    @model_validator(mode='after')
    def check_text_length(self) -> 'IntentRequest':
        if len(self.post_text.split()) < 5:
            raise ValueError('Post too short for classification')
        return self

class IntentResponse(BaseModel):
    intent_type:   Literal['BUYING_INTENT', 'PAIN_SIGNAL', 'COMPARISON_INTENT', 'HIRING_INTENT', 'ANNOUNCEMENT_INTENT']
    confidence:    float = Field(ge=0.0, le=1.0)
    urgency_score: float = Field(ge=0.0, le=1.0)
    justification: str
    sentiment:     Literal['POSITIVE', 'NEGATIVE', 'NEUTRAL']

AnthropicDep = Annotated[AsyncAnthropic, Depends(get_anthropic_client)]

@app.post('/classify', response_model=IntentResponse)
async def classify(req: IntentRequest, client: AnthropicDep) -> IntentResponse:
    # Use claude-haiku-4-5-20251001 — NOT claude-sonnet (10x cheaper)
    ...
```

### Pattern 8: Shared Zod Types — Always Inferred

```typescript
// packages/shared-types/src/lead.ts
import { z } from 'zod'

export const LeadSchema = z.object({
  id:           z.string().uuid(),
  platform:     z.enum(['reddit', 'bluesky', 'linkedin', 'threads', 'mastodon', 'github', 'naukri', 'x']),
  intentType:   z.enum(['BUYING_INTENT', 'PAIN_SIGNAL', 'COMPARISON_INTENT', 'HIRING_INTENT', 'ANNOUNCEMENT_INTENT']),
  leadScore:    z.number().int().min(0).max(100),
  scoreTier:    z.enum(['HOT', 'WARM', 'COOL', 'WEAK', 'DISCARD']),
  email:        z.string().email().nullable(),
  emailStatus:  z.enum(['VALID', 'INVALID', 'RISKY', 'UNKNOWN']).nullable(),
  createdAt:    z.string().datetime(),
})

export type Lead = z.infer<typeof LeadSchema>   // ← ONLY way to get the TS type
```

### Pattern 9: Vitest Tests — Arrange-Act-Assert, Mock All External APIs

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/env', () => ({ env: { HUNTER_API_KEY: 'test-key' } }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn() } }))

describe('findEmailByDomain', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns ok() with email on success', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: { emails: [{ value: 'a@b.com', confidence: 90 }] } })
    }))
    // Act
    const result = await findEmailByDomain('b.com')
    // Assert
    expect(result.isOk()).toBe(true)
    expect(result.unwrap().email).toBe('a@b.com')
  })

  it('returns err(RATE_LIMITED) on 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('429')))
    const result = await findEmailByDomain('b.com')
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe('RATE_LIMITED')
  })
})
```

---

## FOLDER STRUCTURE — DO NOT DEVIATE

```
leadpulse/
├── .github/copilot-instructions.md   ← THIS FILE
├── MASTER_CONTEXT.md                  ← Read every session
├── INFRASTRUCTURE.md                  ← Infra + env vars
├── CODING_PATTERNS.md                 ← All code patterns
├── DB_AND_API_SCHEMA.md               ← DB schema + API contracts
├── SPRINT_PLAN.md                     ← Sprint tasks
├── CLAUDE.md                          ← Current state (update each sprint)
│
├── apps/api/src/
│   ├── index.ts                       ← Hono app + CF Worker export
│   ├── routes/                        ← Mount middleware + handlers (thin)
│   ├── handlers/                      ← Validate → call service → respond (max 20 lines)
│   ├── services/                      ← ALL business logic (Result<T,E>)
│   │   ├── signals/                   ← reddit, bluesky, threads, mastodon
│   │   ├── intent/                    ← intent-orchestrator
│   │   ├── enrichment/                ← waterfall-orchestrator, hunter, apollo, pdl
│   │   ├── verification/              ← zerobounce, twilio-lookup
│   │   ├── scoring/                   ← lead-scorer
│   │   └── crm/                       ← hubspot, salesforce, zoho, pipedrive, router-engine
│   ├── db/
│   │   ├── index.ts                   ← Drizzle + Neon factory
│   │   ├── schema/                    ← One file per domain
│   │   └── migrations/                ← Drizzle Kit generated SQL
│   ├── queues/                        ← CF Queue consumers
│   ├── middleware/                    ← auth, rate-limit, cors
│   └── lib/
│       ├── env.ts                     ← @t3-oss/env-core validated env
│       ├── errors.ts                  ← AppError class hierarchy
│       ├── logger.ts                  ← Pino
│       └── redis.ts                   ← Upstash Redis client
│
├── apps/ml/
│   ├── src/intent/classifier.py
│   ├── src/ner/extractor.py
│   ├── src/scoring/scorer.py
│   └── main.py
│
└── apps/web/src/
    ├── routes/                        ← TanStack Router file-based
    ├── components/
    │   ├── ui/                        ← shadcn/ui
    │   ├── leads/
    │   ├── campaigns/
    │   └── shared/
    ├── lib/
    │   ├── api/client.ts
    │   ├── queries/
    │   └── auth.ts
    └── stores/ui.store.ts             ← Zustand (UI only)
```

---

## API RESPONSE CONTRACT — ZERO DEVIATION

```typescript
// Every single API response must use exactly this format:
{ "success": true, "data": T }
{ "success": true, "data": T, "meta": { "total": N, "page": N, "limit": N, "hasMore": boolean } }
{ "success": false, "error": { "code": ErrorCode, "message": string, "details"?: unknown } }
```

---

## 20 HARD RULES — COPILOT MUST FOLLOW

1.  NEVER suggest Express — use Hono v4
2.  NEVER suggest axios — use ky
3.  NEVER suggest TypeORM — use Drizzle ORM
4.  NEVER suggest Jest — use Vitest
5.  NEVER suggest npm or yarn commands — use pnpm
6.  NEVER suggest `pip install` — use `uv add`
7.  NEVER suggest `console.log` — use Pino logger
8.  NEVER throw exceptions in service functions — use neverthrow Result
9.  NEVER access `process.env.X` directly — use validated `env` object
10. NEVER write raw SQL strings — use Drizzle query builder
11. NEVER use `useState + useEffect` for data fetching — use TanStack Query
12. NEVER write class-based React components
13. NEVER write TypeScript types manually — always `z.infer<>`
14. NEVER use BullMQ — use Cloudflare Queues
15. NEVER use Auth0 — use Firebase Auth
16. ALWAYS add `zValidator` on every API input
17. ALWAYS apply `authMiddleware` on every route with user data
18. ALWAYS wrap React async data with Suspense + ErrorBoundary
19. ALWAYS co-locate test files with source files
20. ALWAYS use Claude Haiku for ML — NOT Claude Sonnet (10x cheaper)

---

## GIT COMMIT FORMAT

```
feat(signals):    add Reddit OAuth2 signal monitor service
fix(scoring):     correct null crash when job_title is missing
perf(api):        cache campaign list with Upstash Redis
refactor(enrich): extract abstract BaseEnrichmentProvider
test(hunter):     add 429 rate-limit case to enrichment tests
chore(deps):      upgrade Drizzle to 0.38.0
docs(claude):     update CLAUDE.md Sprint 2 completion context
```

---

## SESSION START PROTOCOL

At the start of every session:
1. Read CLAUDE.md → check Current Sprint Context
2. Read MASTER_CONTEXT.md → confirm tech stack
3. Read SPRINT_PLAN.md → find current sprint tasks
4. State plan before writing any code (SPRINT / TASK / FILES / PATTERN / FIRST)
5. Wait for confirmation
6. Build one task at a time
7. After each task: `pnpm typecheck && pnpm test`
8. Commit after every working task

---
# Last updated: March 2026 — Sprint 0 (Project Scaffold)
# Update sprint number here when moving to next sprint
