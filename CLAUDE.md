# CLAUDE.md — LeadPulse Intelligence Platform
## Session State Tracker — Updated After Every Sprint
## Version: 3.0 | March 2026 | NEW ARCHITECTURE (Cloudflare Workers + Neon + Firebase)

---

> **AGENT — READ THIS EVERY SESSION.**
> This file tells you exactly where the project is right now.
> Check "Current Sprint Context" at the bottom first — that's the most important section.
> Then read SPRINT_PLAN.md for the specific tasks.

---

## ⚠️ STACK MIGRATION NOTICE (Read This First)

This project was previously planned with Express + TypeORM + Auth0 + BullMQ + Jest.
**That stack has been replaced.** The new stack below is final and must not be reverted.

| OLD (Replaced) | NEW (Current) | Why |
|----------------|--------------|-----|
| Express 4.x | **Hono v4** | Built for Cloudflare Workers, edge-native |
| TypeORM | **Drizzle ORM 0.38** | Type-safe, no class decorators, Neon-compatible |
| Auth0 | **Firebase Auth** | Already owned, free 10K MAU, REST API for Workers |
| BullMQ | **Cloudflare Queues** | Built into Workers, no TCP required |
| Jest | **Vitest 2.x** | ESM-native, faster, same API as Jest |
| AWS ECS + RDS | **Cloudflare Workers + Neon** | 90% cheaper, serverless, zero management |
| Node 20 | **Node 22 LTS** | Latest LTS |
| Python 3.12 | **Python 3.13** | Latest, better match/case, type aliases |
| axios | **ky** | Fetch-based, works in Workers |
| Winston | **Pino 9** | Structured JSON logging |
| try/catch everywhere | **neverthrow Result<T,E>** | Explicit error handling |
| process.env directly | **@t3-oss/env-core** | Zod-validated, fail-fast |

**If Copilot suggests any OLD stack item — correct it immediately.**

---

## Project Identity

**Name:** LeadPulse Intelligence
**Type:** B2B SaaS — Intent-Based Lead Generation + Enrichment Platform
**Vision:** World-class automation from social signal → enriched lead → CRM, fully automated
**Phase:** Phase 1 MVP
**Target:** 10 beta users by Month 3, 100 paying by Month 6

---

## Tech Stack (Final)

### apps/api — Cloudflare Workers
```
Runtime:     Cloudflare Workers (edge, stateless, zero cold starts)
Framework:   Hono v4
Language:    TypeScript 5.7 (strict: true)
ORM:         Drizzle ORM 0.38 + drizzle-kit 0.29
DB Driver:   @neondatabase/serverless (HTTP mode — required for Workers)
Queue:       Cloudflare Queues (built-in Workers binding)
Auth:        Firebase Auth (JWT verify via Firebase REST API)
Cache:       @upstash/redis (REST client — required for Workers)
HTTP Client: ky 1.x
Logging:     Pino 9
Errors:      neverthrow 8 (Result<T,E> pattern)
Validation:  Zod 3.24 + @hono/zod-validator
Env:         @t3-oss/env-core 0.11
Testing:     Vitest 2.x
Deploy:      Wrangler 3 (pnpm wrangler deploy)
```

### apps/ml — EC2 t3.micro
```
Runtime:     Python 3.13
Pkg Manager: uv (NOT pip, NOT poetry)
Framework:   FastAPI 0.115
Validation:  Pydantic v2.10 (strict mode, model_validator, Annotated[])
AI:          anthropic 0.40 (Claude Haiku — cheapest model, not Sonnet)
NLP:         spaCy 3.8 (transformer pipeline for NER)
ML:          scikit-learn 1.6 (lead scoring model)
HTTP:        httpx 0.28 (async)
Process Mgr: PM2 (keep alive on EC2)
Testing:     pytest 8 + pytest-asyncio
```

### apps/web — Vercel
```
Framework:   React 19 (use(), useOptimistic(), useFormStatus())
Language:    TypeScript 5.7 (strict, satisfies operator)
Router:      TanStack Router v1 (file-based, type-safe)
Data:        TanStack Query v5 (useSuspenseQuery — never useQuery with isLoading)
State:       Zustand 5 (UI state ONLY — server state via TanStack Query)
Forms:       React Hook Form 7 + Zod resolver
Styling:     Tailwind CSS v4 (@theme directive)
Components:  shadcn/ui (copy-into-repo)
Tables:      TanStack Table 8
Charts:      Recharts 2
Auth:        firebase 11 (client SDK)
Build:       Vite 6
Testing:     Vitest 2 + RTL
E2E:         Playwright 1.50
Deploy:      Vercel (auto-deploy on push to main)
```

### Infrastructure
```
API:         Cloudflare Workers    → $0 (100K req/day free)
Database:    Neon Serverless PG    → $0 (free tier, scales to zero)
Cache:       Upstash Redis         → $0 (free tier, REST API)
Queue:       Cloudflare Queues     → $0 (1M msg/month free)
Frontend:    Vercel                → $0 (free hobby)
ML Server:   EC2 t3.micro (spot)   → $4-9/mo
Auth:        Firebase Auth         → $0 (10K MAU free)
Storage:     Cloudflare R2         → $0 (10GB free)
Email:       Resend                → $0 (3K/mo free)
Monitoring:  Sentry                → $0 (free tier)
PHASE 1 TOTAL: ~$4-14/month
```

---

## Absolute Rules (NEVER Break These)

### Code Rules
1. Services return `Result<T, AppError>` (neverthrow) — NEVER throw in services
2. NEVER `console.log` — use `logger.info()` / `logger.error()` from Pino
3. NEVER `process.env.X` directly — use validated `env` object from `lib/env.ts`
4. NEVER raw SQL — Drizzle query builder only
5. NEVER write TS types manually — always `z.infer<typeof Schema>`
6. NEVER `any` without inline comment explaining why
7. ALWAYS `zValidator` on every API input
8. ALWAYS `authMiddleware` on every route touching user data
9. ALWAYS co-locate test files: `service.ts` + `service.test.ts`
10. ALWAYS `useSuspenseQuery` in React — NEVER `useQuery` with `isLoading`

### Structure Rules
11. Handlers are thin: validate → call service → return response (max 20 lines)
12. Business logic ONLY in services
13. DB queries ONLY in services (never in handlers or routes)
14. Use path aliases (`@/services/...`) — never relative imports (`../../`)

### Infra Rules
15. API on Cloudflare Workers ONLY (never suggest EC2 for API)
16. DB via `@neondatabase/serverless` HTTP adapter (NOT pg direct connection)
17. Cache via `@upstash/redis` REST client (NOT ioredis — needs TCP)
18. Queue via Cloudflare Queues (NOT BullMQ — needs TCP Redis)
19. EC2 ONLY for Python ML service
20. Claude Haiku for ML inference (NOT Claude Sonnet — 10x cheaper)

---

## API Response Contract

```typescript
// Every API response — zero deviation
Success: { success: true, data: T, meta?: { total, page, limit, hasMore } }
Error:   { success: false, error: { code: ErrorCode, message: string, details?: unknown } }

ErrorCode: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'FORBIDDEN' |
           'RATE_LIMITED' | 'QUOTA_EXCEEDED' | 'EXTERNAL_API_ERROR' |
           'ENRICHMENT_FAILED' | 'CRM_SYNC_FAILED' | 'INTERNAL_ERROR'
```

---

## Document Index

| File | Purpose | Read When |
|------|---------|-----------|
| MASTER_CONTEXT.md | Full project context, rules, stack | Every session (after this file) |
| INFRASTRUCTURE.md | Env vars, deployment, service setup | Setting up infra, deploying |
| CODING_PATTERNS.md | Code patterns with working examples | Writing any code |
| DB_AND_API_SCHEMA.md | DB schema, API contracts | DB work, API endpoints |
| SPRINT_PLAN.md | Sprint task lists | Current sprint tasks |
| CLAUDE.md | THIS FILE — current state | Every session, first |

---

## Session Protocol

```
Every session, in order:
1. Read CLAUDE.md (this file) → check Current Sprint Context below
2. Read MASTER_CONTEXT.md → confirm stack understanding
3. Read SPRINT_PLAN.md → find current sprint tasks
4. Before writing code, state plan:

   SPRINT: [N]
   TASK: [S{N}-T{N}: name]
   FILES:
     + path — what I create
     ~ path — what I modify
   PATTERN: [from CODING_PATTERNS.md]
   FIRST: [first action]

5. Wait for confirmation
6. Build one task at a time
7. After each task: pnpm typecheck && pnpm test
8. Commit: feat(scope): S{N}-T{N} description
9. After sprint done: update "Current Sprint Context" below
```

---

## Current Sprint Context

```
Last Updated:    March 2026
Current Phase:   Phase 1 — MVP
Current Sprint:  Sprint 0 — Project Scaffold

Sprint 0 Status: NOT STARTED — No code has been written yet.

What exists:
  - Documentation only (this file + 5 other .md files)
  - No monorepo, no code, no deployments

First task:
  - S0-T1: Create Turborepo monorepo root structure
  - See SPRINT_PLAN.md → Sprint 0 for complete task list

Completed sprints: None

Known issues: None

Notes for next session:
  - Start with S0-T1 (monorepo root)
  - Read INFRASTRUCTURE.md before creating wrangler.toml
  - Use CODING_PATTERNS.md for every service you write
  - The .github/copilot-instructions.md file must be created as
    part of Sprint 0 setup — copy from the file in this repo root
```

---

*⚠️ Update the "Current Sprint Context" section above at the end of every sprint.*
*Include: sprint number, what was completed, what was skipped, known issues, next steps.*
