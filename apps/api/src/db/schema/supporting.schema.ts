import {
  pgTable, uuid, varchar, text, integer, decimal,
  boolean, jsonb, timestamp, index,
} from 'drizzle-orm/pg-core'
import { users } from './users.schema'
import { leads } from './leads.schema'
import { integrations } from './integrations.schema'
import { campaigns } from './campaigns.schema'

// ── Router Rules ───────────────────────────────────────────────
export const routerRules = pgTable('router_rules', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
  name:       varchar('name', { length: 255 }).notNull(),
  conditions: jsonb('conditions').notNull(),  // { field, operator, value }[]
  actions:    jsonb('actions').notNull(),      // { type, target, value }[]
  priority:   integer('priority').default(0).notNull(),
  isActive:   boolean('is_active').default(true).notNull(),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── CRM Sync Log ───────────────────────────────────────────────
export const crmSyncLog = pgTable('crm_sync_log', {
  id:            uuid('id').primaryKey().defaultRandom(),
  leadId:        uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  integrationId: uuid('integration_id').notNull().references(() => integrations.id),
  status:        varchar('status', { length: 50 }).notNull(),      // success | failed | retrying
  crmRecordId:   varchar('crm_record_id', { length: 255 }),
  errorMessage:  text('error_message'),
  attemptedAt:   timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
  succeededAt:   timestamp('succeeded_at', { withTimezone: true }),
})

// ── Enrichment Log ─────────────────────────────────────────────
export const enrichmentLog = pgTable('enrichment_log', {
  id:             uuid('id').primaryKey().defaultRandom(),
  leadId:         uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  provider:       varchar('provider', { length: 100 }).notNull(),
  dataType:       varchar('data_type', { length: 50 }).notNull(),
  status:         varchar('status', { length: 50 }).notNull(),      // success | not_found | error | skipped
  costInr:        decimal('cost_inr', { precision: 8, scale: 2 }).default('0').notNull(),
  responseTimeMs: integer('response_time_ms'),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Verification Log ───────────────────────────────────────────
export const verificationLog = pgTable('verification_log', {
  id:               uuid('id').primaryKey().defaultRandom(),
  leadId:           uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  verificationType: varchar('verification_type', { length: 50 }).notNull(),  // email | phone | linkedin | domain
  provider:         varchar('provider', { length: 100 }).notNull(),
  result:           varchar('result', { length: 50 }).notNull(),
  rawResponse:      jsonb('raw_response'),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Subreddit Intelligence ─────────────────────────────────────
export const subredditIntelligence = pgTable('subreddit_intelligence', {
  id:             uuid('id').primaryKey().defaultRandom(),
  subredditName:  varchar('subreddit_name', { length: 100 }).unique().notNull(),
  nicheTags:      text('niche_tags').array().default([]).notNull(),
  avgLeadScore:   integer('avg_lead_score').default(0).notNull(),
  leadVolumeEst:  integer('lead_volume_est').default(0).notNull(),
  qualityTier:    varchar('quality_tier', { length: 20 }).notNull(),  // A | B | C
  lastAnalyzedAt: timestamp('last_analyzed_at', { withTimezone: true }),
})

// ── Usage Events ───────────────────────────────────────────────
export const usageEvents = pgTable(
  'usage_events',
  {
    id:         uuid('id').primaryKey().defaultRandom(),
    userId:     uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    eventType:  varchar('event_type', { length: 100 }).notNull(),  // lead_created | enrichment_done | crm_push
    quantity:   integer('quantity').default(1).notNull(),
    campaignId: uuid('campaign_id'),
    timestamp:  timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdTimestampIdx: index('usage_user_timestamp_idx').on(t.userId, t.timestamp),
  }),
)

// ── Notifications ──────────────────────────────────────────────
export const notifications = pgTable('notifications', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type:      varchar('type', { length: 100 }).notNull(),    // new_hot_lead | quota_warning | enrichment_complete
  title:     varchar('title', { length: 255 }).notNull(),
  body:      text('body').notNull(),
  leadId:    uuid('lead_id'),
  isRead:    boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type RouterRule            = typeof routerRules.$inferSelect
export type CrmSyncLog            = typeof crmSyncLog.$inferSelect
export type EnrichmentLog         = typeof enrichmentLog.$inferSelect
export type VerificationLog       = typeof verificationLog.$inferSelect
export type SubredditIntelligence = typeof subredditIntelligence.$inferSelect
export type UsageEvent            = typeof usageEvents.$inferSelect
export type Notification          = typeof notifications.$inferSelect
