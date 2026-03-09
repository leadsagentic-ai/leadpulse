# SPRINT_PLAN.md — LeadPulse Intelligence Platform
## Complete Sprint Task List for Agent Execution
## Version: 1.0 | March 2026

---

> **AGENT INSTRUCTION:** Read this file to understand what to build in the current sprint.
> Always check CLAUDE.md first to know which sprint you're currently on.
> Complete one task at a time. Commit after each task. Update CLAUDE.md after each sprint.

---

## PHASE 1 — MVP (Month 1-3, Sprints 1-7)

### SPRINT 0 — Project Scaffold (Week 0, 2-3 days)

**Goal:** Fully working monorepo where every `pnpm dev` command starts and `pnpm test` passes.

#### Tasks

**S0-T1: Turborepo Monorepo Root**
- Create `leadpulse/` root with `package.json` (pnpm workspaces), `pnpm-workspace.yaml`, `turbo.json`
- Create `.gitignore` (node_modules, .turbo, dist, .wrangler, .dev.vars, *.env*, __pycache__)
- Create `apps/api/`, `apps/ml/`, `apps/web/`, `packages/shared-types/`, `packages/shared-utils/` directories
- Acceptance: `pnpm install` completes without errors

**S0-T2: apps/api — Hono + Cloudflare Workers Scaffold**
- Create `apps/api/package.json` with: `hono@4`, `@hono/zod-validator`, `zod@3`, `neverthrow@8`, `pino@9`, `ky@1`, `drizzle-orm@0.38`, `@neondatabase/serverless@0.10`, `@upstash/redis@1`, `@t3-oss/env-core@0.11`, `wrangler@3`, `drizzle-kit@0.29`, `vitest@2`, `typescript@5.7`
- Create `apps/api/tsconfig.json` with strict mode, path aliases (`@/*` → `./src/*`)
- Create `apps/api/wrangler.toml` from INFRASTRUCTURE.md section 3
- Create `apps/api/src/index.ts` — Hono app with GET /health returning `{status:"ok"}`
- Create `apps/api/src/lib/env.ts` — @t3-oss/env-core with all vars from INFRASTRUCTURE.md
- Create `apps/api/src/lib/errors.ts` — AppError hierarchy from CODING_PATTERNS.md Pattern 1
- Create `apps/api/src/lib/logger.ts` — Pino structured logger
- Create `apps/api/src/lib/redis.ts` — Upstash Redis client
- Create `apps/api/src/db/index.ts` — Drizzle + Neon factory from CODING_PATTERNS.md Pattern 2
- Create `apps/api/drizzle.config.ts` from DB_AND_API_SCHEMA.md section 6
- Create `apps/api/.dev.vars.example` — all variables, empty values
- Acceptance: `pnpm --filter api dev` starts on port 8787, `curl localhost:8787/health` returns 200

**S0-T3: apps/ml — FastAPI + Python Scaffold**
- Create `apps/ml/pyproject.toml` with: `fastapi@0.115`, `pydantic@2.10`, `anthropic@0.40`, `spacy@3.8`, `httpx@0.28`, `pydantic-settings@2`
- Create `apps/ml/.python-version` with content `3.13`
- Create `apps/ml/main.py` from CODING_PATTERNS.md Pattern 9 (FastAPI app with /health endpoint and auth middleware)
- Create `apps/ml/src/intent/classifier.py` with IntentClassificationRequest/Response models
- Create `apps/ml/src/intent/prompts.py` with INTENT_SYSTEM_PROMPT
- Create `apps/ml/src/ner/extractor.py` — empty placeholder with TODO comment
- Create `apps/ml/src/scoring/scorer.py` — empty placeholder
- Create `apps/ml/ecosystem.config.js` from INFRASTRUCTURE.md section 6
- Create `apps/ml/.env.example` — ANTHROPIC_API_KEY, ML_SERVICE_SECRET, PORT
- Acceptance: `cd apps/ml && uv sync && uv run uvicorn main:app --reload` starts, /health returns 200

**S0-T4: apps/web — React 19 + Vite Scaffold**
- Create `apps/web/package.json` with: `react@19`, `@tanstack/react-router@1`, `@tanstack/react-query@5`, `zustand@5`, `react-hook-form@7`, `tailwindcss@4`, `firebase@11`, `vitest@2`, `vite@6`, `typescript@5.7`, `shadcn/ui` deps
- Create `apps/web/tsconfig.json`, `apps/web/vite.config.ts`
- Create `apps/web/src/main.tsx` — React 19 root with QueryClientProvider + RouterProvider
- Create `apps/web/src/routes/__root.tsx` — root layout with basic shell (sidebar + header)
- Create `apps/web/src/lib/auth.ts` from CODING_PATTERNS.md Pattern 8 (Firebase Auth helpers)
- Create `apps/web/.env.example` with VITE_ variables from INFRASTRUCTURE.md
- Install shadcn/ui: `pnpm dlx shadcn@latest init` (select: TypeScript, Tailwind 4, App Router)
- Acceptance: `pnpm --filter web dev` starts on port 5173, shows blank layout with no errors

**S0-T5: packages/shared-types Scaffold**
- Create `packages/shared-types/package.json`, `tsconfig.json`
- Create `packages/shared-types/src/lead.ts` from CODING_PATTERNS.md Pattern 11 (all Zod schemas)
- Create `packages/shared-types/src/campaign.ts` (CampaignSchema)
- Create `packages/shared-types/src/api.ts` (ApiSuccess, ApiError, ApiResponse, ErrorCode)
- Create `packages/shared-types/src/index.ts` — re-exports
- Acceptance: `pnpm --filter @leadpulse/shared-types build` passes

**S0-T6: CI/CD GitHub Actions**
- Create `.github/workflows/ci.yml`:
  ```
  Triggers: push to main, pull_request
  Jobs:
    api-test:  pnpm install → pnpm --filter api typecheck → pnpm --filter api test
    web-test:  pnpm install → pnpm --filter web typecheck → pnpm --filter web test
    ml-test:   uv sync → uv run pytest apps/ml/tests/
  ```
- Acceptance: Push a commit, CI pipeline runs green

---

### SPRINT 1 — Auth + DB Schema + Campaign CRUD (Weeks 1-2)

**Goal:** Users can sign in with Google and create/manage campaigns. DB fully migrated.

#### Tasks

**S1-T1: Complete Database Schema Migration**
- Create ALL schema files from DB_AND_API_SCHEMA.md section 1:
  - `users.schema.ts`, `workspaces.schema.ts`, `campaigns.schema.ts`
  - `leads.schema.ts`, `integrations.schema.ts`, `supporting.schema.ts`
  - `index.ts` (re-exports all)
- Run: `pnpm --filter api db:generate -- --name initial-schema`
- Run: `pnpm --filter api db:migrate`
- Acceptance: All 12 tables exist in Neon DB. `pnpm --filter api db:studio` shows all tables.

**S1-T2: Auth Middleware**
- Create `apps/api/src/middleware/auth.middleware.ts` from CODING_PATTERNS.md Pattern 4
- Create `apps/api/src/middleware/rate-limit.middleware.ts` using `@upstash/ratelimit`
- Create `apps/api/src/middleware/cors.middleware.ts` (restrict to FRONTEND_URL)
- Write tests: `auth.middleware.test.ts` covering valid token, missing token, expired token
- Acceptance: All auth middleware tests pass

**S1-T3: Campaign CRUD Service + Handler + Routes**
- Create `apps/api/src/services/campaign.service.ts`:
  - `createCampaign(db, userId, input): Promise<Result<Campaign, AppError>>`
  - `listCampaigns(db, userId, filters): Promise<Result<{campaigns, total}, AppError>>`
  - `getCampaignById(db, userId, id): Promise<Result<Campaign, AppError>>`
  - `updateCampaign(db, userId, id, input): Promise<Result<Campaign, AppError>>`
  - `patchCampaignStatus(db, userId, id, status): Promise<Result<Campaign, AppError>>`
  - `deleteCampaign(db, userId, id): Promise<Result<void, AppError>>`
- Create `apps/api/src/handlers/campaigns.handler.ts` — thin handlers calling campaign service
- Create `apps/api/src/routes/campaigns.routes.ts` from CODING_PATTERNS.md Pattern 3
- Mount routes in `src/index.ts`
- Write tests: `campaign.service.test.ts` — happy path + not-found + forbidden
- Acceptance: All campaign CRUD endpoints work. `pnpm --filter api test` passes.

**S1-T4: User Service (create on first login)**
- Create `apps/api/src/services/user.service.ts`:
  - `upsertUser(db, firebaseUid, email, fullName): Promise<Result<User, AppError>>`
  - `getUserById(db, userId): Promise<Result<User, AppError>>`
  - `getUserByFirebaseUid(db, firebaseUid): Promise<Result<User, AppError>>`
- Create `POST /api/v1/auth/login` endpoint — upserts user on first Firebase login
- Write tests: `user.service.test.ts`
- Acceptance: POST /auth/login with valid Firebase JWT creates user in DB

**S1-T5: Web — Firebase Auth Flow**
- Create `apps/web/src/routes/login.tsx` — Google sign-in button using `signInWithGoogle()`
- Create `apps/web/src/routes/__root.tsx` — auth guard (redirect to /login if not authenticated)
- Create TanStack Query `queryClient` with auth token interceptor (adds `Authorization: Bearer {token}`)
- Create `apps/web/src/lib/api/client.ts` — ky instance with base URL and auth header
- Acceptance: User can sign in with Google, gets redirected to dashboard. Firebase JWT is attached to all API calls.

---

### SPRINT 2 — Reddit Signal Monitor (Weeks 3-4)

**Goal:** System polls Reddit every 30 minutes for campaign keywords and stores raw signals.

#### Tasks

**S2-T1: Reddit OAuth2 + Search Service**
- Create `apps/api/src/services/signals/reddit.service.ts`:
  - `getRedditAccessToken(clientId, secret): Promise<Result<string, AppError>>` — OAuth2 client credentials
  - `searchRedditPosts(query, subreddits, accessToken, limit): Promise<Result<RedditPost[], AppError>>`
  - Rate limit: max 60 req/min via Upstash rate limiter
- Create `RedditPost` interface (id, title, selftext, url, author, created_utc, score, subreddit)
- Write tests with mocked fetch responses
- Acceptance: Can search Reddit posts, returns typed array

**S2-T2: Signal Processing Queue + Deduplication**
- Create `apps/api/src/queues/signal-processing.queue.ts` from CODING_PATTERNS.md Pattern 7
- Create `apps/api/src/services/deduplication.service.ts`:
  - `isDuplicate(redis, postUrl): Promise<boolean>` — check Upstash Redis for seen posts
  - `markAsSeen(redis, postUrl, ttlSeconds): Promise<void>` — store for 7 days
- Acceptance: Same post URL is never processed twice (Redis dedup works)

**S2-T3: Campaign Signal Poller (Scheduled Worker)**
- Create `apps/api/src/scheduled/signal-poller.ts`:
  - Called by Cloudflare Workers `scheduled` event (cron: every 30 minutes)
  - For each active campaign: fetch keywords → search Reddit → dedup → queue each new post
- Wire into `src/index.ts` as the `scheduled` export
- Write integration test (mock Reddit API + queue send)
- Acceptance: Wrangler triggers the scheduled event, new posts get queued

**S2-T4: Basic Lead Record Creation**
- Create `apps/api/src/services/lead.service.ts`:
  - `createLeadFromSignal(db, signal, userId, campaignId): Promise<Result<Lead, AppError>>`
  - `getLeadById(db, userId, id): Promise<Result<Lead, AppError>>`
  - `listLeads(db, userId, filters): Promise<Result<{leads, total}, AppError>>`
- Create leads routes: `GET /leads`, `GET /leads/:id`, `PATCH /leads/:id/status`
- Acceptance: Reddit posts become Lead records in DB with status='pending'

---

### SPRINT 3 — Bluesky + Threads + Mastodon (Weeks 5-6)

**Goal:** 3 more platforms monitored. All Phase 1 platforms complete.

#### Tasks

**S3-T1: Bluesky AT Protocol Signal Service**
- Create `apps/api/src/services/signals/bluesky.service.ts`
- Use AT Protocol: `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts`
- No authentication needed for public search (free)
- Normalize posts to same `RawSignal` interface as Reddit
- Tests: mock AT Protocol response
- Acceptance: Campaign keywords searched on Bluesky, posts normalized to RawSignal format

**S3-T2: Threads Meta API Signal Service**
- Create `apps/api/src/services/signals/threads.service.ts`
- Use Meta Graph API: `GET https://graph.threads.net/v1/threads` (requires OAuth token)
- Store Threads OAuth token per user in integrations table (encrypted)
- Tests: mock Meta API response
- Acceptance: Threads posts with matching keywords returned

**S3-T3: Mastodon Federated API Signal Service**
- Create `apps/api/src/services/signals/mastodon.service.ts`
- Use `https://mastodon.social/api/v2/search?q={keyword}&type=statuses`
- No auth required for public search
- Tests: mock Mastodon API response
- Acceptance: Mastodon posts searched across mastodon.social

**S3-T4: Unified Platform Signal Orchestrator**
- Create `apps/api/src/services/signals/signal-orchestrator.service.ts`:
  - `pollPlatformsForCampaign(db, redis, campaign, env): Promise<void>`
  - Calls whichever platforms are in `campaign.platforms`
  - Returns combined array of normalized RawSignals
  - Deduplicates before queuing
- Update cron job (S2-T3) to use the orchestrator
- Acceptance: Active campaign with `platforms: ['reddit','bluesky']` gets signals from both

---

### SPRINT 4 — Intent Classification Engine (Weeks 7-8)

**Goal:** Every new lead post is classified by Claude Haiku for intent type, confidence, urgency.

#### Tasks

**S4-T1: ML Service — Intent Classifier**
- Complete `apps/ml/src/intent/classifier.py` from CODING_PATTERNS.md Pattern 9
- Complete `apps/ml/src/intent/prompts.py` — system prompt + user prompt builder
- Test with pytest: mock Anthropic API, test 5 intent types + edge cases (short post, foreign language)
- Acceptance: POST /classify returns valid IntentClassificationResponse

**S4-T2: API — Intent Orchestrator Service**
- Create `apps/api/src/services/intent/intent-orchestrator.service.ts`:
  - `classifyIntent(postText, authorBio, personaFilter, platform, env): Promise<Result<IntentResult, AppError>>`
  - Calls ML service via ky with ML_SERVICE_SECRET header
  - Handles ML service timeouts (30s max), returns error on timeout
  - Falls back gracefully — if ML fails, lead is still created with intentType = null
- Tests: mock ML service HTTP call
- Acceptance: Workers → ML HTTP call works. IntentResult stored on lead record.

**S4-T3: Wire Intent Classification into Signal Processing Queue**
- Update `signal-processing.queue.ts` handler to call `classifyIntent` after receiving signal
- Store intent_type, intent_confidence, intent_justification, urgency_score on lead record
- If confidence < 0.5: discard lead (don't create DB record)
- If confidence ≥ 0.5: create lead record with classification
- Acceptance: Reddit posts create classified Lead records in DB with intent scores

---

### SPRINT 5 — NER + Enrichment (Weeks 9-10)

**Goal:** Lead identity extracted, email enrichment via Hunter.io, basic lead score calculated.

#### Tasks

**S5-T1: NER Entity Extraction (ML Service)**
- Complete `apps/ml/src/ner/extractor.py`:
  - Load spaCy `en_core_web_sm` model
  - Extract: PERSON (name), ORG (company), GPE (location), job title (regex patterns)
  - `extract_entities(post_text, author_bio): EntityExtractionResponse`
- Add `POST /extract-entities` endpoint to FastAPI
- Tests: mock spaCy, test each entity type
- Acceptance: POST /extract-entities returns name, company, location

**S5-T2: Hunter.io Email Enrichment Service**
- Create `apps/api/src/services/enrichment/hunter.service.ts` from CODING_PATTERNS.md Pattern 1
- Handle: domain not found (ok, empty), rate limited (err RATE_LIMITED), API error (err EXTERNAL_API_ERROR)
- Log enrichment cost to `enrichment_log` table
- Tests: all cases from CODING_PATTERNS.md Pattern 10
- Acceptance: `findEmailByDomain('google.com')` returns email or empty Result.ok

**S5-T3: Enrichment Waterfall Orchestrator (Phase 1 — Hunter only)**
- Create `apps/api/src/services/enrichment/waterfall-orchestrator.service.ts`:
  - `enrichLead(db, lead, env): Promise<Result<Lead, AppError>>`
  - Step 1: If company_domain exists → call Hunter.io
  - If email found: save to lead, mark enrichedAt, stop
  - If no domain: skip enrichment, mark enrichedAt with null email
  - Log each step to enrichment_log table
- Wire into enrichment queue consumer
- Tests: mock Hunter, verify enrichment_log records created
- Acceptance: Lead with company_domain gets email enriched via Hunter

**S5-T4: Lead Scoring v1 (Basic)**
- Create `apps/api/src/services/scoring/lead-scorer.service.ts`:
  - `calculateLeadScore(lead): number` — implements 5-dimension model from MASTER_CONTEXT.md section 7
  - `getScoreTier(score): ScoreTier` — HOT/WARM/COOL/WEAK/DISCARD thresholds
- Call scorer after enrichment completes, save score + score_tier to lead
- Tests: test all 5 dimensions with known inputs/outputs
- Acceptance: HOT leads (score≥80) are correctly identified. Score math is correct.

---

### SPRINT 6 — React Dashboard MVP (Weeks 11-12)

**Goal:** Working web UI — campaign creation, live lead feed, lead profile, CSV export.

#### Tasks

**S6-T1: Dashboard Shell + Navigation**
- Complete `apps/web/src/routes/__root.tsx` — sidebar with: Dashboard, Leads, Campaigns, Settings
- Create `apps/web/src/components/shared/Sidebar.tsx` using shadcn/ui Navigation
- Create `apps/web/src/components/shared/Layout.tsx`
- Create `apps/web/src/components/shared/Skeletons.tsx` — skeleton components for each view

**S6-T2: Campaign Manager UI**
- Create `apps/web/src/routes/campaigns/index.tsx` — campaign list view
- Create `apps/web/src/routes/campaigns/new.tsx` — create campaign form
- Create `apps/web/src/components/campaigns/CampaignWizard.tsx` — multi-step form using React Hook Form + Zod
  - Step 1: Name + keywords + exclusions
  - Step 2: Platform selection (Reddit, Bluesky, Threads, Mastodon)
  - Step 3: Intent filters + persona filter
  - Step 4: Notification settings + confirm
- Create `apps/web/src/lib/queries/campaigns.queries.ts` — queryOptions factories
- Acceptance: User creates a campaign from UI. Campaign appears in API response.

**S6-T3: Lead Feed + Filters**
- Create `apps/web/src/routes/leads/index.tsx` — lead feed view
- Create `apps/web/src/components/leads/LeadFeed.tsx` from CODING_PATTERNS.md Pattern 8
- Create `apps/web/src/components/leads/LeadCard.tsx` — shows: score badge, intent type, platform icon, post excerpt, key data points (email, company, role), CTA buttons
- Create `apps/web/src/components/leads/LeadFilters.tsx` — platform, intent, score range, status, date range filters
- Create `apps/web/src/lib/queries/leads.queries.ts` — queryOptions factories
- Implement pagination (TanStack Virtual or infinite scroll)
- Acceptance: Lead feed shows leads from API. Filters work. Score badges show correct tiers.

**S6-T4: Lead Profile Page**
- Create `apps/web/src/routes/leads/$leadId.tsx`
- Create `apps/web/src/components/leads/LeadProfile.tsx`:
  - Original post text + source link
  - AI intent classification + justification + confidence bar
  - All enriched contact details (email, phone, LinkedIn, company, location)
  - Data completeness indicator
  - Score breakdown (all 5 dimensions)
  - Action buttons: Approve, Discard, Push to CRM (Phase 2), Re-enrich
  - Compliance badge (GDPR-safe, DPDP-safe)
  - Enrichment source attribution

**S6-T5: CSV Export**
- Create `POST /api/v1/leads/export` endpoint:
  - Accepts filter params (same as GET /leads)
  - Generates CSV in Cloudflare Worker (streaming)
  - Uploads to R2, returns signed download URL (expires 1 hour)
- Create export button in Lead Table view
- Acceptance: User clicks Export, downloads CSV with all visible columns. Works for up to 10K leads.

---

### SPRINT 7 — Testing + Beta Launch (Week 13)

**Goal:** Stable, tested, 10 beta users onboarded.

#### Tasks

**S7-T1: Integration Tests**
- Write integration tests for the complete pipeline:
  - Reddit poll → dedup → queue → intent classify → NER extract → Hunter enrich → score → DB record
  - Mock all external APIs. Test the full happy path end-to-end.
- Target: 80% service coverage across apps/api

**S7-T2: Error Monitoring + Alerting**
- Install Sentry in apps/api (Cloudflare Workers SDK)
- Install Sentry in apps/web
- Set up alert: if more than 5 errors/minute → notify via email
- Add request ID to all error responses (for support)

**S7-T3: Performance Check**
- Verify API response times: list endpoints < 500ms, lead profile < 300ms
- Add Redis caching to campaign list endpoint (cache for 60 seconds per user)
- Add Redis caching to analytics endpoint (cache for 5 minutes)

**S7-T4: Beta Onboarding**
- Create welcome email template (Resend)
- Create in-app onboarding checklist: "Create your first campaign" → "See your first lead" → "Connect your CRM"
- Onboard 10 beta users

---

## PHASE 2 — CORE PRODUCT (Month 4-6, Sprints 8-13)

> Full details will be added to this document before Sprint 8 begins.
> Summary below for planning context.

| Sprint | Focus | Key Deliverable |
|--------|-------|----------------|
| S8 | Enrichment waterfall Phase 2 | Apollo.io + PDL + Proxycurl LinkedIn |
| S9 | Verification layer | ZeroBounce email + Twilio phone verification |
| S10 | ML Lead Scoring v2 | 5-dimension model running in ML service |
| S11 | HubSpot + Salesforce integrations | OAuth2 flow + field mapping + sync log |
| S12 | Zoho + Pipedrive + Lead Router | Routing rules engine + webhook integrations |
| S13 | GitHub + Naukri + Mastodon | Complete Phase 1 platform coverage + billing |

---

## PHASE 3 — SCALE (Month 7-12, Sprints 14-26)

> Details added before Sprint 14 begins.

| Sprint | Focus |
|--------|-------|
| S14-15 | Analytics dashboard + platform ROI reports |
| S16-17 | Chrome Extension (LinkedIn profile capture) |
| S18-19 | Twitter/X premium add-on |
| S20-21 | Enterprise features (SSO, audit log, compliance report) |
| S22-23 | Public REST API + developer documentation |
| S24-26 | Scale, mobile-responsive, Monday + Notion integrations |

---

## AGENT TASK EXECUTION FORMAT

When working on any sprint task, follow this format EVERY time:

```
READING:        CLAUDE.md → Sprint N context
SPRINT:         N
TASK:           S{N}-T{N}: [Task Name]
PHASE:          [Phase 1/2/3]

CREATING FILES:
  + [file path] — [what it contains]
  + [file path] — [what it contains]

MODIFYING FILES:
  ~ [file path] — [what changes]

PATTERN USED:   [Pattern N from CODING_PATTERNS.md]

STARTING WITH:  [First file I will create/edit]
```

Wait for confirmation, then execute. After completing the task:
1. Run `pnpm typecheck && pnpm test`
2. Fix any errors before committing
3. Commit: `git commit -m 'feat(scope): S{N}-T{N} - task description'`
4. If this was the last task of the sprint: update CLAUDE.md
