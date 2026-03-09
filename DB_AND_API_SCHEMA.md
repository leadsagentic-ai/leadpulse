# DB_AND_API_SCHEMA.md — LeadPulse Intelligence Platform
## Complete Database Schema + API Contracts
## Version: 1.0 | March 2026

---

> **AGENT INSTRUCTION:** Read this file when:
> - Creating or modifying database schema files
> - Writing Drizzle migrations
> - Building API endpoints
> - Writing API client code in apps/web

---

## 1. DATABASE SCHEMA — COMPLETE

All tables use PostgreSQL via Neon Serverless. All schema files live in `apps/api/src/db/schema/`.

### Schema File Organization

```
apps/api/src/db/schema/
├── index.ts           ← Re-exports ALL schemas (import from here)
├── users.schema.ts
├── campaigns.schema.ts
├── leads.schema.ts
├── integrations.schema.ts
├── workspaces.schema.ts
└── supporting.schema.ts   ← All other tables
```

### index.ts — re-export everything

```typescript
// apps/api/src/db/schema/index.ts
export * from './users.schema'
export * from './campaigns.schema'
export * from './leads.schema'
export * from './integrations.schema'
export * from './workspaces.schema'
export * from './supporting.schema'
```

---

### TABLE: users

```typescript
// apps/api/src/db/schema/users.schema.ts
import { pgTable, pgEnum, uuid, varchar, integer, timestamp, index } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces.schema'

export const planTierEnum = pgEnum('plan_tier', ['starter', 'growth', 'pro', 'enterprise'])

export const users = pgTable(
  'users',
  {
    id:                 uuid('id').primaryKey().defaultRandom(),
    firebaseUid:        varchar('firebase_uid', { length: 128 }).unique().notNull(),
    email:              varchar('email', { length: 255 }).unique().notNull(),
    fullName:           varchar('full_name', { length: 255 }).notNull(),
    planTier:           planTierEnum('plan_tier').default('starter').notNull(),
    workspaceId:        uuid('workspace_id').references(() => workspaces.id),
    monthlyLeadQuota:   integer('monthly_lead_quota').default(200).notNull(),
    leadsUsedThisMonth: integer('leads_used_this_month').default(0).notNull(),
    createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt:        timestamp('last_login_at', { withTimezone: true }),
  },
  (t) => ({
    firebaseUidIdx: index('users_firebase_uid_idx').on(t.firebaseUid),
    emailIdx:       index('users_email_idx').on(t.email),
  }),
)

export type User    = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
```

---

### TABLE: workspaces + workspace_members

```typescript
// apps/api/src/db/schema/workspaces.schema.ts
import { pgTable, pgEnum, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core'

export const workspaceMemberRoleEnum = pgEnum('workspace_member_role', ['admin', 'member', 'viewer'])

export const workspaces = pgTable('workspaces', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        varchar('name', { length: 255 }).notNull(),
  ownerUserId: uuid('owner_user_id').notNull(),
  planTier:    varchar('plan_tier', { length: 50 }).default('starter').notNull(),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id:          uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    userId:      uuid('user_id').notNull(),
    role:        workspaceMemberRoleEnum('role').default('member').notNull(),
    invitedAt:   timestamp('invited_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceUserIdx: index('wm_workspace_user_idx').on(t.workspaceId, t.userId),
  }),
)

export type Workspace          = typeof workspaces.$inferSelect
export type WorkspaceMember    = typeof workspaceMembers.$inferSelect
```

---

### TABLE: campaigns

```typescript
// apps/api/src/db/schema/campaigns.schema.ts
import { pgTable, pgEnum, uuid, varchar, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users.schema'

export const campaignStatusEnum    = pgEnum('campaign_status',    ['active', 'paused', 'archived'])
export const notificationFreqEnum  = pgEnum('notification_freq',  ['realtime', 'hourly', 'daily'])

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
    personaFilter:     text('persona_filter'),
    geoFilter:         text('geo_filter').array().default([]).notNull(),
    notificationFreq:  notificationFreqEnum('notification_freq').default('daily').notNull(),
    status:            campaignStatusEnum('status').default('active').notNull(),
    createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx:  index('campaigns_user_id_idx').on(t.userId),
    statusIdx:  index('campaigns_status_idx').on(t.status),
  }),
)

export type Campaign    = typeof campaigns.$inferSelect
export type NewCampaign = typeof campaigns.$inferInsert
```

---

### TABLE: leads (largest, most important)

```typescript
// apps/api/src/db/schema/leads.schema.ts
import { pgTable, pgEnum, uuid, varchar, text, integer, decimal, boolean, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users.schema'
import { campaigns } from './campaigns.schema'

export const intentTypeEnum = pgEnum('intent_type', [
  'BUYING_INTENT', 'PAIN_SIGNAL', 'COMPARISON_INTENT', 'HIRING_INTENT', 'ANNOUNCEMENT_INTENT'
])
export const scoreTierEnum    = pgEnum('score_tier',    ['HOT', 'WARM', 'COOL', 'WEAK', 'DISCARD'])
export const emailStatusEnum  = pgEnum('email_status',  ['VALID', 'INVALID', 'RISKY', 'UNKNOWN'])
export const phoneStatusEnum  = pgEnum('phone_status',  ['VALID', 'INVALID', 'UNVERIFIED'])
export const leadStatusEnum   = pgEnum('lead_status',   ['pending', 'approved', 'discarded', 'pushed_crm'])

export const leads = pgTable(
  'leads',
  {
    id:                  uuid('id').primaryKey().defaultRandom(),
    campaignId:          uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
    userId:              uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

    // Platform + post data
    platform:            varchar('platform', { length: 50 }).notNull(),
    postUrl:             text('post_url').notNull(),
    postText:            text('post_text').notNull(),
    postPublishedAt:     timestamp('post_published_at', { withTimezone: true }).notNull(),
    postEngagement:      integer('post_engagement').default(0).notNull(),

    // AI classification
    intentType:          intentTypeEnum('intent_type').notNull(),
    intentConfidence:    decimal('intent_confidence', { precision: 4, scale: 3 }).notNull(),
    intentJustification: text('intent_justification').notNull(),
    urgencyScore:        decimal('urgency_score',    { precision: 4, scale: 3 }).default('0').notNull(),
    personaMatchScore:   decimal('persona_match_score', { precision: 4, scale: 3 }).default('0').notNull(),

    // Identity (extracted by NER)
    name:                varchar('name', { length: 255 }),
    username:            varchar('username', { length: 255 }).notNull(),
    platformProfileUrl:  text('platform_profile_url').notNull(),
    jobTitle:            varchar('job_title', { length: 255 }),
    company:             varchar('company', { length: 255 }),
    companyDomain:       varchar('company_domain', { length: 255 }),
    location:            varchar('location', { length: 255 }),
    industry:            varchar('industry', { length: 255 }),
    companySize:         varchar('company_size', { length: 50 }),

    // Enriched contact data
    email:               varchar('email', { length: 255 }),
    emailStatus:         emailStatusEnum('email_status'),
    emailProvider:       varchar('email_provider', { length: 100 }),
    phone:               varchar('phone', { length: 50 }),
    phoneStatus:         phoneStatusEnum('phone_status'),
    linkedinUrl:         text('linkedin_url'),

    // Score
    leadScore:           integer('lead_score').default(0).notNull(),
    scoreTier:           scoreTierEnum('score_tier').notNull(),

    // Status
    status:              leadStatusEnum('lead_status').default('pending').notNull(),
    crmPushedAt:         timestamp('crm_pushed_at', { withTimezone: true }),
    crmRecordUrl:        text('crm_record_url'),

    // Compliance
    complianceGdprSafe:  boolean('compliance_gdpr_safe').default(true).notNull(),
    complianceDpdpSafe:  boolean('compliance_dpdp_safe').default(true).notNull(),

    // Timestamps
    createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    enrichedAt:          timestamp('enriched_at', { withTimezone: true }),
  },
  (t) => ({
    // Most queried indexes
    userIdIdx:    index('leads_user_id_idx').on(t.userId),
    campaignIdx:  index('leads_campaign_id_idx').on(t.campaignId),
    scoreIdx:     index('leads_score_idx').on(t.leadScore),
    statusIdx:    index('leads_status_idx').on(t.status),
    platformIdx:  index('leads_platform_idx').on(t.platform),
    intentIdx:    index('leads_intent_type_idx').on(t.intentType),
    createdAtIdx: index('leads_created_at_idx').on(t.createdAt),
  }),
)

export type Lead    = typeof leads.$inferSelect
export type NewLead = typeof leads.$inferInsert
```

---

### TABLE: integrations

```typescript
// apps/api/src/db/schema/integrations.schema.ts
import { pgTable, pgEnum, uuid, varchar, text, jsonb, boolean, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users.schema'

export const crmTypeEnum         = pgEnum('crm_type',          ['hubspot', 'salesforce', 'zoho', 'pipedrive', 'webhook', 'make'])
export const integrationStatusEnum = pgEnum('integration_status', ['connected', 'disconnected', 'error'])

export const integrations = pgTable(
  'integrations',
  {
    id:                    uuid('id').primaryKey().defaultRandom(),
    userId:                uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    crmType:               crmTypeEnum('crm_type').notNull(),
    accessTokenEncrypted:  text('access_token_encrypted'),
    refreshTokenEncrypted: text('refresh_token_encrypted'),
    tokenExpiresAt:        timestamp('token_expires_at', { withTimezone: true }),
    webhookUrl:            text('webhook_url'),
    webhookSecret:         text('webhook_secret'),
    fieldMappings:         jsonb('field_mappings').default({}).notNull(),
    status:                integrationStatusEnum('integration_status').default('disconnected').notNull(),
    lastSyncAt:            timestamp('last_sync_at', { withTimezone: true }),
    createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index('integrations_user_id_idx').on(t.userId),
  }),
)

export type Integration    = typeof integrations.$inferSelect
export type NewIntegration = typeof integrations.$inferInsert
```

---

### SUPPORTING TABLES

```typescript
// apps/api/src/db/schema/supporting.schema.ts
import { pgTable, pgEnum, uuid, varchar, text, integer, decimal, boolean, jsonb, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users.schema'
import { leads } from './leads.schema'
import { integrations } from './integrations.schema'
import { campaigns } from './campaigns.schema'

// ── Router Rules ────────────────────────────────────────────────
export const routerRules = pgTable('router_rules', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
  name:       varchar('name', { length: 255 }).notNull(),
  conditions: jsonb('conditions').notNull(),   // { field, operator, value }[]
  actions:    jsonb('actions').notNull(),       // { type, target, value }[]
  priority:   integer('priority').default(0).notNull(),
  isActive:   boolean('is_active').default(true).notNull(),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── CRM Sync Log ────────────────────────────────────────────────
export const crmSyncLog = pgTable('crm_sync_log', {
  id:            uuid('id').primaryKey().defaultRandom(),
  leadId:        uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  integrationId: uuid('integration_id').notNull().references(() => integrations.id),
  status:        varchar('status', { length: 50 }).notNull(),    // success | failed | retrying
  crmRecordId:   varchar('crm_record_id', { length: 255 }),
  errorMessage:  text('error_message'),
  attemptedAt:   timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
  succeededAt:   timestamp('succeeded_at', { withTimezone: true }),
})

// ── Enrichment Log ──────────────────────────────────────────────
export const enrichmentLog = pgTable('enrichment_log', {
  id:             uuid('id').primaryKey().defaultRandom(),
  leadId:         uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  provider:       varchar('provider', { length: 100 }).notNull(),
  dataType:       varchar('data_type', { length: 50 }).notNull(),
  status:         varchar('status', { length: 50 }).notNull(),    // success | not_found | error | skipped
  costInr:        decimal('cost_inr', { precision: 8, scale: 2 }).default('0').notNull(),
  responseTimeMs: integer('response_time_ms'),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Verification Log ────────────────────────────────────────────
export const verificationLog = pgTable('verification_log', {
  id:               uuid('id').primaryKey().defaultRandom(),
  leadId:           uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  verificationType: varchar('verification_type', { length: 50 }).notNull(),   // email | phone | linkedin | domain
  provider:         varchar('provider', { length: 100 }).notNull(),
  result:           varchar('result', { length: 50 }).notNull(),
  rawResponse:      jsonb('raw_response'),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Subreddit Intelligence ──────────────────────────────────────
export const subredditIntelligence = pgTable('subreddit_intelligence', {
  id:                uuid('id').primaryKey().defaultRandom(),
  subredditName:     varchar('subreddit_name', { length: 100 }).unique().notNull(),
  nicheTags:         text('niche_tags').array().default([]).notNull(),
  avgLeadScore:      integer('avg_lead_score').default(0).notNull(),
  leadVolumeEst:     integer('lead_volume_est').default(0).notNull(),
  qualityTier:       varchar('quality_tier', { length: 20 }).notNull(),   // A | B | C
  lastAnalyzedAt:    timestamp('last_analyzed_at', { withTimezone: true }),
})

// ── Usage Events ────────────────────────────────────────────────
export const usageEvents = pgTable(
  'usage_events',
  {
    id:         uuid('id').primaryKey().defaultRandom(),
    userId:     uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    eventType:  varchar('event_type', { length: 100 }).notNull(),   // lead_created | enrichment_done | crm_push
    quantity:   integer('quantity').default(1).notNull(),
    campaignId: uuid('campaign_id'),
    timestamp:  timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdTimestampIdx: index('usage_user_timestamp_idx').on(t.userId, t.timestamp),
  }),
)

// ── Notifications ───────────────────────────────────────────────
export const notifications = pgTable('notifications', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type:      varchar('type', { length: 100 }).notNull(),   // new_hot_lead | quota_warning | enrichment_complete
  title:     varchar('title', { length: 255 }).notNull(),
  body:      text('body').notNull(),
  leadId:    uuid('lead_id'),
  isRead:    boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type RouterRule          = typeof routerRules.$inferSelect
export type CrmSyncLog          = typeof crmSyncLog.$inferSelect
export type EnrichmentLog       = typeof enrichmentLog.$inferSelect
export type VerificationLog     = typeof verificationLog.$inferSelect
export type SubredditIntelligence = typeof subredditIntelligence.$inferSelect
export type UsageEvent          = typeof usageEvents.$inferSelect
export type Notification        = typeof notifications.$inferSelect
```

---

## 2. DRIZZLE MIGRATION WORKFLOW

```bash
# Generate migration from schema changes
pnpm --filter api db:generate -- --name descriptive-migration-name

# Apply migrations to database
pnpm --filter api db:migrate

# Open Drizzle Studio (GUI to inspect DB)
pnpm --filter api db:studio

# RULES:
# - NEVER edit a migration file after it has been run
# - ALWAYS create a new migration for schema changes
# - ALWAYS describe the migration clearly in the name
# - Example names:
#   add-campaigns-table
#   add-email-status-to-leads
#   add-enrichment-log-indexes
```

---

## 3. REST API — COMPLETE ENDPOINT REFERENCE

**Base URL:** `https://leadpulse-api.YOUR_SUBDOMAIN.workers.dev/api/v1`
**Auth:** All endpoints (except /health) require `Authorization: Bearer {firebase_jwt}`

### 3.1 Campaigns

```
GET    /campaigns                   List all campaigns (paginated, filterable)
POST   /campaigns                   Create new campaign
GET    /campaigns/:id               Get campaign details + stats
PUT    /campaigns/:id               Update campaign (full update)
PATCH  /campaigns/:id/status        Activate or pause campaign { status: "active" | "paused" }
DELETE /campaigns/:id               Archive campaign (soft delete)
GET    /campaigns/:id/analytics     Campaign performance metrics
```

**POST /campaigns — Request Body:**
```typescript
{
  name:              string            // required, max 255
  keywords:          string[]          // required, min 1, max 20 items
  exclusionKeywords: string[]          // optional, default []
  intentFilters:     IntentType[]      // optional, default [] (all types)
  platforms:         Platform[]        // required, min 1
  subredditTargets:  string[]          // optional (reddit-only filter)
  language:          string            // optional, default "en"
  minEngagement:     number            // optional, default 0
  personaFilter:     string            // optional, max 500 chars
  geoFilter:         string[]          // optional, ISO country codes
  notificationFreq:  "realtime" | "hourly" | "daily"  // default "daily"
}
```

### 3.2 Leads

```
GET    /leads                        List leads (paginated, filterable)
GET    /leads/:id                    Get full lead profile
PATCH  /leads/:id/status             Update lead status { status: "approved" | "discarded" | "pending" }
POST   /leads/:id/push-crm           Push to CRM { integrationId: string, pipelineId?: string }
POST   /leads/:id/re-enrich          Trigger re-enrichment (async, returns job ID)
GET    /leads/:id/audit-log          Enrichment + verification + CRM audit log
POST   /leads/export                 Generate CSV export → returns { downloadUrl, expiresAt }
DELETE /leads/:id                    Hard delete (GDPR right-to-erasure)
```

**GET /leads — Query Params:**
```
page          number    default: 1
limit         number    default: 20, max: 100
platform      string    filter by platform
intentType    string    filter by intent type
scoreTier     string    HOT | WARM | COOL | WEAK | DISCARD
minScore      number    min lead score
maxScore      number    max lead score
status        string    pending | approved | discarded | pushed_crm
campaignId    string    UUID
emailStatus   string    VALID | INVALID | RISKY | UNKNOWN
dateFrom      string    ISO datetime
dateTo        string    ISO datetime
```

### 3.3 Integrations

```
GET    /integrations                  List all integrations for user
POST   /integrations/hubspot/connect  Start HubSpot OAuth flow → { authUrl }
POST   /integrations/salesforce/connect
POST   /integrations/zoho/connect
POST   /integrations/pipedrive/connect
POST   /integrations/webhook          Configure webhook { url, secret, events[] }
POST   /integrations/make             Configure Make webhook
GET    /integrations/:id/field-map    Get field mapping config
PUT    /integrations/:id/field-map    Update field mapping { mappings: { leadField: crmField }[] }
DELETE /integrations/:id              Disconnect and delete
GET    /integrations/:id/sync-log     CRM sync audit log (paginated)
```

### 3.4 Analytics

```
GET    /analytics/overview            Dashboard stats { leadsTotal, hotLeads, enrichmentRate, avgScore }
GET    /analytics/leads-over-time     Lead volume time series { granularity: "day" | "week" | "month" }
GET    /analytics/platform-breakdown  Leads + avg score by platform
GET    /analytics/intent-breakdown    Leads + avg score by intent type
GET    /analytics/enrichment-funnel   Enrichment waterfall success rates
GET    /analytics/top-campaigns       Top performing campaigns by lead quality
```

---

## 4. WEBHOOK PAYLOAD SCHEMA

When a lead is created or scored, LeadPulse fires POST to configured webhook URLs.

```json
{
  "event": "lead.created",
  "timestamp": "2026-03-15T10:23:45Z",
  "workspace_id": "uuid",
  "lead": {
    "id": "uuid",
    "score": 82,
    "score_tier": "HOT",
    "intent_type": "BUYING_INTENT",
    "intent_confidence": 0.94,
    "intent_justification": "Post explicitly mentions budget and timeline for purchase",
    "platform": "reddit",
    "post_url": "https://reddit.com/r/entrepreneur/comments/...",
    "post_text": "Looking for CRM for our 10-person team...",
    "post_published_at": "2026-03-15T10:20:00Z",
    "created_at": "2026-03-15T10:23:40Z",
    "profile": {
      "name": "John Doe",
      "username": "johndoe_reddit",
      "platform_profile_url": "https://reddit.com/u/johndoe_reddit",
      "job_title": "Head of Sales",
      "company": "Acme Corp",
      "company_domain": "acmecorp.com",
      "location": "Bangalore, India",
      "industry": "B2B SaaS",
      "company_size": "50-200",
      "email": "john@acmecorp.com",
      "email_status": "VALID",
      "phone": "+91-9876543210",
      "phone_status": "VALID",
      "linkedin_url": "https://linkedin.com/in/johndoe"
    },
    "compliance": {
      "source_type": "public_post",
      "enrichment_type": "b2b_data",
      "gdpr_safe": true,
      "dpdp_safe": true
    }
  }
}
```

**Webhook retry logic:** 3 attempts with exponential backoff (10s, 100s, 1000s).
**Webhook signature header:** `X-LeadPulse-Signature: sha256={HMAC_SHA256(payload, secret)}`

---

## 5. ML SERVICE API (Internal)

The ML service runs on EC2 and is called only from Cloudflare Workers API. It is NOT public.

**Base URL:** `http://{EC2_PRIVATE_IP}:8000` (or public IP with security group restriction)
**Auth:** `Authorization: Bearer {ML_SERVICE_SECRET}` (shared secret)

```
GET  /health            Health check
POST /classify          Intent classification
POST /extract-entities  NER entity extraction (Phase 2)
POST /score             Lead score calculation (Phase 2)
```

**POST /classify — Request:**
```json
{
  "post_text": "Looking for CRM for our 10-person team, budget around $500/mo",
  "author_bio": "Head of Sales at Acme Corp | B2B SaaS",
  "persona_filter": "VP Sales, Head of Sales, SDR",
  "platform": "reddit"
}
```

**POST /classify — Response:**
```json
{
  "intent_type": "BUYING_INTENT",
  "confidence": 0.94,
  "urgency_score": 0.81,
  "justification": "Post explicitly states 'looking for CRM' with budget and team size indicating active purchase evaluation",
  "sentiment": "POSITIVE"
}
```

---

## 6. DRIZZLE CONFIG

```typescript
// apps/api/drizzle.config.ts
import { defineConfig } from 'drizzle-kit'
import { config } from 'dotenv'

config({ path: '.dev.vars' })

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out:    './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict:  true,
})
```

```json
// In apps/api/package.json scripts:
{
  "db:generate": "drizzle-kit generate",
  "db:migrate":  "drizzle-kit migrate",
  "db:studio":   "drizzle-kit studio",
  "db:seed":     "tsx src/db/seed.ts"
}
```
