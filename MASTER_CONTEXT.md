# MASTER_CONTEXT.md — LeadPulse Intelligence Platform
## Primary Context for Claude Sonnet 4.6 Agent
## Version: 3.0 | March 2026 | Cost-Optimized Architecture

---

> **AGENT — READ THIS ENTIRE FILE BEFORE TOUCHING ANY CODE.**
> This is your ground truth. It supersedes anything you learned in training.
> After reading this file, read the file relevant to your current task.

---

## READING MAP — WHICH FILE TO READ FOR YOUR TASK

| Your current task | Read this file next |
|---|---|
| First session / project setup | INFRASTRUCTURE.md |
| Writing any TypeScript or Python code | CODING_PATTERNS.md |
| Working on DB schema, migrations | DB_AND_API_SCHEMA.md |
| Working on API endpoints | DB_AND_API_SCHEMA.md |
| Sprint tasks and what to build | SPRINT_PLAN.md |
| Checking current sprint state | CLAUDE.md |

---

## 1. WHAT IS LEADPULSE

**LeadPulse Intelligence** is a production-grade, intent-based B2B lead generation SaaS platform.

**What it does in one sentence:** It watches 8 social platforms in real time, uses Claude AI to detect buying intent in posts, enriches those leads with contact data through a cost-optimized waterfall, verifies the data, scores each lead 0-100, and automatically routes HOT leads into the user's CRM.

**The problem it solves:** SDRs and recruiters waste 3-4 hours/day manually scanning platforms. LeadPulse fully automates signal detection → enrichment → verification → CRM routing.

**Why it wins vs Apollo/Clay/Lusha:**
- First platform to combine real-time intent monitoring + AI classification + waterfall enrichment in one product
- Covers Bluesky, Threads, Mastodon, GitHub — NO competitor does this
- India-first pricing (INR, Razorpay, Naukri support) — all competitors are USD-only
- Transparent 0-100 scoring model — unique in the market

---

## 2. PLATFORM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│  apps/web  —  React 19 + TanStack  —  Deployed: VERCEL (free)  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS / Firebase JWT
┌──────────────────────────▼──────────────────────────────────────┐
│  apps/api  —  Hono v4  —  Deployed: CLOUDFLARE WORKERS         │
│                                                                   │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐   │
│  │ Auth: Firebase│  │ Cache: Upstash  │  │ Queue: CF Queues │   │
│  │ JWT verify   │  │ Redis (REST)    │  │ (built-in)       │   │
│  └──────────────┘  └─────────────────┘  └──────────────────┘   │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │           Drizzle ORM → Neon Serverless Postgres           │  │
│  │          (via @neondatabase/serverless HTTP driver)         │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP (internal auth)
┌──────────────────────────▼──────────────────────────────────────┐
│  apps/ml  —  FastAPI 0.115 + Python 3.13  —  EC2 t3.micro      │
│                                                                   │
│  Intent Classifier (Claude Haiku) + NER (spaCy) + Scorer       │
└─────────────────────────────────────────────────────────────────┘
```

**Why this infra (cost reasoning):**
- Cloudflare Workers: 100K req/day FREE → $5/mo at 10M req. Zero cold starts. Hono is built for it.
- Neon Postgres: Scales to zero (no idle cost). Free 0.5GB. HTTP driver works in Workers.
- Upstash Redis: REST API (no TCP connection = works in Workers). Free 10K cmd/day.
- Cloudflare Queues: Built-in to Workers. BullMQ needs persistent Redis TCP = incompatible.
- Vercel: Free hobby plan for frontend. Auto-deploys on push.
- EC2 t3.micro: ONLY for Python. spaCy/scikit-learn need native binaries — cannot run in Workers. $4-9/mo on spot.
- Firebase Auth: Free 10K MAU. REST API works in Workers. Replaces Auth0 (which was $23+/mo).

**Phase 1 total infra cost: $14-20/month.**

---

## 3. MONOREPO STRUCTURE

```
leadpulse/                              ← Turborepo root (pnpm workspaces)
├── .github/
│   └── copilot-instructions.md        ← Copilot reads this automatically
│
├── MASTER_CONTEXT.md                   ← THIS FILE — read first every session
├── INFRASTRUCTURE.md                   ← Infra, env vars, deployment commands
├── CODING_PATTERNS.md                  ← All code patterns with working examples
├── DB_AND_API_SCHEMA.md               ← Complete DB schema + API contracts
├── SPRINT_PLAN.md                      ← Sprint task lists
├── CLAUDE.md                           ← Current sprint state — update after every sprint
│
├── apps/
│   ├── api/                            ← Cloudflare Workers + Hono v4
│   │   ├── src/
│   │   │   ├── index.ts               ← Hono app + CF Worker export
│   │   │   ├── routes/                ← Route groups (thin — mount middleware + handlers)
│   │   │   ├── handlers/              ← Validate → call service → respond
│   │   │   ├── services/              ← ALL business logic (returns Result<T,E>)
│   │   │   │   ├── signals/           ← reddit.service.ts, bluesky.service.ts, etc.
│   │   │   │   ├── intent/            ← intent-orchestrator.service.ts
│   │   │   │   ├── enrichment/        ← waterfall-orchestrator, hunter, apollo, pdl, proxycurl
│   │   │   │   ├── verification/      ← zerobounce.service.ts, twilio-lookup.service.ts
│   │   │   │   ├── scoring/           ← lead-scorer.service.ts
│   │   │   │   └── crm/               ← hubspot, salesforce, zoho, pipedrive, router-engine
│   │   │   ├── db/
│   │   │   │   ├── index.ts           ← Drizzle + Neon client factory
│   │   │   │   ├── schema/            ← One schema file per domain
│   │   │   │   └── migrations/        ← Drizzle Kit generated SQL
│   │   │   ├── queues/                ← CF Queue consumers
│   │   │   ├── middleware/            ← auth, rate-limit, cors
│   │   │   └── lib/
│   │   │       ├── env.ts             ← @t3-oss/env-core validated env
│   │   │       ├── errors.ts          ← AppError class hierarchy
│   │   │       ├── logger.ts          ← Pino structured logger
│   │   │       └── redis.ts           ← Upstash Redis client
│   │   ├── wrangler.toml
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   │
│   ├── ml/                             ← Python 3.13 + FastAPI on EC2
│   │   ├── src/
│   │   │   ├── intent/classifier.py
│   │   │   ├── intent/prompts.py
│   │   │   ├── ner/extractor.py
│   │   │   └── scoring/scorer.py
│   │   ├── main.py
│   │   ├── pyproject.toml
│   │   └── ecosystem.config.js        ← PM2 config
│   │
│   └── web/                            ← React 19 on Vercel
│       ├── src/
│       │   ├── routes/                ← TanStack Router file-based routes
│       │   ├── components/
│       │   │   ├── ui/                ← shadcn/ui (copied in)
│       │   │   ├── leads/             ← LeadCard, LeadFeed, LeadProfile, LeadFilters
│       │   │   ├── campaigns/         ← CampaignWizard, CampaignList
│       │   │   └── shared/            ← Layout, Sidebar, ErrorBoundary, Skeletons
│       │   ├── lib/
│       │   │   ├── api/client.ts      ← Type-safe API client
│       │   │   ├── queries/           ← TanStack Query queryOptions factories
│       │   │   └── auth.ts            ← Firebase Auth helpers
│       │   └── stores/ui.store.ts     ← Zustand (UI state ONLY)
│       └── package.json
│
├── packages/
│   ├── shared-types/                   ← Zod schemas + inferred TS types
│   └── shared-utils/                   ← Pure utility functions
│
├── package.json                        ← pnpm workspaces root
├── pnpm-workspace.yaml
└── turbo.json
```

---

## 4. CANONICAL TECH STACK — March 2026

> **AGENT RULE:** These are the ONLY libraries you may use.
> If it is not listed here, do NOT use it. Ask the developer first.

### apps/api — Cloudflare Workers

| Concern | Library | Version | Critical Rule |
|---------|---------|---------|---------------|
| Runtime | Cloudflare Workers | latest | Edge-native. No EC2/ECS for API. |
| Framework | Hono | 4.x | Built for Workers. NOT Express. NOT Fastify. |
| Language | TypeScript | 5.7.x | `strict: true`. No `any` without comment. |
| Validation | Zod | 3.24.x | `z.infer<>` everywhere. Never write types manually. |
| ORM | Drizzle ORM | 0.38.x | Type-safe SQL. NOT TypeORM. NOT Prisma. |
| DB Driver | @neondatabase/serverless | 0.10.x | HTTP mode for Workers. |
| Migrations | drizzle-kit | 0.29.x | `pnpm db:generate` then `pnpm db:migrate` |
| Queue | Cloudflare Queues | built-in | Workers Queues API. NOT BullMQ. |
| Auth | Firebase Admin (HTTP) | REST API | Verify JWT via Firebase REST. NOT Auth0. |
| HTTP Client | ky | 1.x | Fetch-based. NOT axios. NOT node-fetch. |
| Logging | Pino | 9.x | Structured JSON. NEVER `console.log`. |
| Error Handling | neverthrow | 8.x | `Result<T,E>` pattern. Services NEVER throw. |
| Testing | Vitest | 2.x | NOT Jest. Co-located `.test.ts` files. |
| Env Validation | @t3-oss/env-core | 0.11.x | Zod-validated. Fails fast on startup. |
| Cache | @upstash/redis | 1.x | REST client — works in Workers. |
| Package Manager | pnpm | 9.x | NOT npm. NOT yarn. |

### apps/ml — EC2 Python Service

| Concern | Library | Version | Critical Rule |
|---------|---------|---------|---------------|
| Runtime | Python | 3.13 | `match/case`, type aliases, strict annotations. |
| Package Manager | uv | latest | NOT pip. NOT poetry. `uv add` / `uv run`. |
| Framework | FastAPI | 0.115.x | `Annotated[]` for all dependencies. |
| Validation | Pydantic | v2.10.x | `model_validator`, `strict=True`. NOT v1. |
| AI SDK | anthropic | 0.40.x | Async client. Claude Haiku for classification. |
| NLP | spaCy | 3.8.x | Transformer pipeline for NER. |
| ML | scikit-learn | 1.6.x | Lead scoring model. |
| HTTP | httpx | 0.28.x | Async-native. NOT requests. |
| Process Mgr | PM2 | latest | Keep FastAPI alive on EC2. |
| Testing | pytest + pytest-asyncio | 8.x | Async test support everywhere. |

### apps/web — Vercel React

| Concern | Library | Version | Critical Rule |
|---------|---------|---------|---------------|
| Framework | React | 19.x | `use()`, `useOptimistic()`, `useFormStatus()`. |
| Language | TypeScript | 5.7.x | strict, `satisfies` operator aggressively. |
| Router | TanStack Router | 1.x | File-based. Type-safe routes + search params. |
| Data Fetching | TanStack Query | 5.x | `queryOptions()` factory. `useSuspenseQuery`. |
| State | Zustand | 5.x | UI state ONLY. Server state = TanStack Query. |
| Forms | React Hook Form | 7.x | `+ zod` resolver always. No uncontrolled forms. |
| Styling | Tailwind CSS | 4.x | CSS-first config. `@theme` directive. |
| Components | shadcn/ui | latest | Copy-into-repo. Fully accessible. |
| Tables | TanStack Table | 8.x | Headless, typed. |
| Charts | Recharts | 2.x | Analytics dashboards. |
| Build | Vite | 6.x | ESM-only. `vite-plugin-checker`. |
| Auth Client | firebase | 11.x | Firebase Auth client SDK. |
| Testing | Vitest + RTL | 2.x | Co-located. Suspense-aware. |
| E2E | Playwright | 1.50.x | Critical user journeys only. |

---

## 5. THE 8 MONITORED PLATFORMS

| Platform | API Method | Cost/month | Phase | Priority |
|----------|-----------|-----------|-------|----------|
| Reddit | Official Reddit API (OAuth2) | ₹3,000-8,000 | Phase 1 | P0 |
| Bluesky | AT Protocol (open, free) | ₹0 | Phase 1 | P0 |
| Threads | Meta Graph API | ₹0-2,000 | Phase 1 | P1 |
| Mastodon | Federated open API | ₹0 | Phase 1 | P1 |
| GitHub Discussions | GitHub API v3 (free) | ₹0 | Phase 2 | P2 |
| LinkedIn | Proxycurl partner API | ₹20,000-60,000 | Phase 2 | P2 |
| Naukri/Indeed | Domain extraction + enrichment | ₹0 | Phase 2 | P2 |
| Twitter/X | X Basic API ($100/mo) | ₹8,000+ | Phase 3 | Premium |

---

## 6. INTENT CLASSIFICATION SYSTEM

**5 Intent Types** (classified by Claude Haiku, NOT Claude Sonnet — cost reason):

| Intent | Example Post | Lead Priority | Score Weight |
|--------|-------------|---------------|-------------|
| `BUYING_INTENT` | "Looking for CRM for 10-person team, budget $500/mo" | HIGHEST | Intent type: 10pts |
| `PAIN_SIGNAL` | "Our CRM keeps losing data. Need to switch urgently" | HIGH | 9pts |
| `COMPARISON_INTENT` | "HubSpot vs Pipedrive for B2B startup?" | HIGH | 8pts |
| `HIRING_INTENT` | "Hiring VP Sales — scaling GTM from 3 to 10" | MEDIUM | 6pts |
| `ANNOUNCEMENT_INTENT` | "Just raised $2M seed! Building in HR tech" | MEDIUM | 5pts |

**Classification output per post:**
- `intent_type` — one of the 5 above
- `confidence` — 0.0-1.0
- `urgency_score` — 0.0-1.0
- `sentiment` — POSITIVE / NEGATIVE / NEUTRAL
- `justification` — 1-sentence AI explanation referencing exact phrases

---

## 7. LEAD SCORING MODEL (0-100)

| Dimension | Weight | Max Points | What is measured |
|-----------|--------|-----------|-----------------|
| Intent Strength | 30% | 30pts | `intent_type_weight × confidence × urgency_score` |
| Data Completeness | 25% | 25pts | email_verified +8, phone +6, linkedin +5, domain +4, name +2 |
| Platform Quality | 20% | 20pts | LinkedIn=10, Reddit=8, GitHub=7, Bluesky=6, Threads=5, Mastodon=4 |
| Engagement Signal | 15% | 15pts | Recency: 24h=15, 72h=10, 7d=7, older=3 |
| Persona Match | 10% | 10pts | Job title + company size + industry vs campaign config |

**Score Tiers:**

| Range | Tier | Action |
|-------|------|--------|
| 80-100 | HOT | Push to CRM immediately |
| 60-79 | WARM | Push with nurture tag |
| 40-59 | COOL | Add to watchlist |
| 20-39 | WEAK | Archive only |
| 0-19 | DISCARD | Auto-discard |

---

## 8. ENRICHMENT WATERFALL (Phase 1-2)

The waterfall stops as soon as data is found. Each step only fires if the previous step failed.

| Step | Provider | Data | Cost/req | Success Rate |
|------|----------|------|----------|-------------|
| 1 | Hunter.io | Business email from domain | ₹2.50 | 45-60% |
| 2 | Apollo.io | Email, phone, LinkedIn, company | ₹3.00 | 55-70% |
| 3 | People Data Labs | Full profile | ₹8.00 | 60-75% |
| 4 | Clearbit | Company data, tech stack | ₹12.00 | 65-80% |
| 5 | Lusha | Phone numbers | ₹15.00 | 25-40% |

**Average cost per lead:** ₹4-8 (vs ₹15-25 if all providers called simultaneously)

Phase 1 implements: Hunter.io only (step 1).
Phase 2 adds: Apollo, PDL, Proxycurl for LinkedIn.

---

## 9. API RESPONSE CONTRACT — NEVER DEVIATE

Every API response MUST use exactly this format:

```typescript
// SUCCESS
{ "success": true, "data": T, "meta"?: { "total": number, "page": number, "limit": number, "hasMore": boolean } }

// ERROR
{ "success": false, "error": { "code": ErrorCode, "message": string, "details"?: unknown, "requestId"?: string } }
```

**All valid error codes:**
```
VALIDATION_ERROR | NOT_FOUND | UNAUTHORIZED | FORBIDDEN |
RATE_LIMITED | QUOTA_EXCEEDED | EXTERNAL_API_ERROR |
ENRICHMENT_FAILED | CRM_SYNC_FAILED | INTERNAL_ERROR
```

---

## 10. GIT COMMIT CONVENTION

```
feat(signals):    add Reddit OAuth2 signal monitor with poll scheduler
fix(scoring):     correct null crash in persona-match when job_title missing
perf(api):        add Upstash cache layer to campaign list endpoint
refactor(enrich): extract abstract BaseEnrichmentProvider class
test(hunter):     add 429 rate-limit case to Hunter enrichment suite
chore(deps):      upgrade Drizzle ORM to 0.38.0
docs(claude):     update CLAUDE.md Sprint 2 context
```

---

## 11. ABSOLUTE RULES — AGENT MUST FOLLOW WITHOUT EXCEPTION

### Code Rules
1. Services ALWAYS return `Result<T, AppError>` (neverthrow) — NEVER `throw` in services
2. NEVER use `console.log` — use `logger.info()` / `logger.error()` from Pino
3. NEVER access `process.env.X` directly — use the `env` object from `lib/env.ts`
4. NEVER write raw SQL — use Drizzle query builder
5. NEVER write TypeScript types manually — always `z.infer<typeof Schema>`
6. NEVER use `any` TypeScript type without an inline comment explaining why
7. ALWAYS add `zValidator` Zod validation on every API input
8. ALWAYS apply `authMiddleware` on every route that touches user data
9. ALWAYS co-locate test files with source files (`service.ts` → `service.test.ts`)
10. ALWAYS use `useSuspenseQuery` in React — NEVER `useQuery` with `isLoading`

### Structure Rules
11. NEVER put business logic in handlers — handlers call services only
12. NEVER put DB queries in handlers or routes — only in services
13. NEVER use relative imports (`../../`) — use path aliases (`@/services/...`)
14. NEVER create files outside the folder structure without asking
15. Handlers are thin: validate input → call service → return response — max 20 lines

### Infra Rules
16. API runs on Cloudflare Workers ONLY — never suggest EC2/ECS for the API
17. DB is Neon Postgres — use `@neondatabase/serverless` HTTP adapter
18. Cache is Upstash Redis — use `@upstash/redis` REST client
19. Queue is Cloudflare Queues — NOT BullMQ (requires TCP, incompatible with Workers)
20. EC2 is ONLY for Python ML service — nothing else runs there

### ML Rules
21. Intent classification uses Claude Haiku — NOT Claude Sonnet (10x cheaper)
22. ML service is called via HTTP from Workers — it is a separate service
23. NEVER call ML service synchronously on the hot path — always via queue

---

## 12. SESSION START PROTOCOL — RUN EVERY TIME

When you (the agent) start a new session:

```
STEP 1: Read MASTER_CONTEXT.md (this file) fully ✓
STEP 2: Read CLAUDE.md → check "Current Sprint Context" at the bottom
STEP 3: Read SPRINT_PLAN.md for current sprint task details
STEP 4: Before writing any code, state your plan in this exact format:

SPRINT: [N]
TASK: [task name]
FILES I WILL CREATE OR MODIFY:
  - [exact path] — [what I will do]
  - [exact path] — [what I will do]
PATTERNS I WILL USE: [from CODING_PATTERNS.md]
FIRST ACTION: [one sentence]

STEP 5: Wait for developer confirmation
STEP 6: Build one task at a time
STEP 7: After each task: pnpm typecheck && pnpm test
STEP 8: After sprint complete: update CLAUDE.md sprint context
```

---

## 13. PRODUCT PRICING (CONTEXT)

| Plan | Price | Leads/month | Platforms | CRM |
|------|-------|-------------|-----------|-----|
| Starter | ₹2,999/mo | 200 | 2 | Email export only |
| Growth | ₹7,999/mo | 1,000 | 5 | 1 CRM |
| Pro | ₹19,999/mo | 5,000 | All 8 | All CRMs |
| Enterprise | Custom | Unlimited | All 8 + custom | All + custom |

**Twitter/X monitoring:** ₹2,000/mo add-on
**Extra lead credits:** ₹199 per 100 leads

---

## 14. SUCCESS METRICS (YEAR 1)

| Metric | Month 3 | Month 6 | Month 12 |
|--------|---------|---------|----------|
| Paying customers | 10 beta | 100 | 1,000 |
| MRR | ₹2L | ₹8L | ₹50L+ |
| Leads generated (total) | 50K | 500K | 5M+ |
| Avg lead score | 60+ | 70+ | 75+ |
| Email verification rate | 80%+ | 85%+ | 90%+ |
