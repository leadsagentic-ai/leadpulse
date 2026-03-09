import {
  pgTable, pgEnum, uuid, varchar, text, integer,
  decimal, boolean, timestamp, index,
} from 'drizzle-orm/pg-core'
import { users } from './users.schema'
import { campaigns } from './campaigns.schema'

export const intentTypeEnum  = pgEnum('intent_type',  ['BUYING_INTENT', 'PAIN_SIGNAL', 'COMPARISON_INTENT', 'HIRING_INTENT', 'ANNOUNCEMENT_INTENT'])
export const scoreTierEnum   = pgEnum('score_tier',   ['HOT', 'WARM', 'COOL', 'WEAK', 'DISCARD'])
export const emailStatusEnum = pgEnum('email_status', ['VALID', 'INVALID', 'RISKY', 'UNKNOWN'])
export const phoneStatusEnum = pgEnum('phone_status', ['VALID', 'INVALID', 'UNVERIFIED'])
export const leadStatusEnum  = pgEnum('lead_status',  ['pending', 'approved', 'discarded', 'pushed_crm'])

export const leads = pgTable(
  'leads',
  {
    id:               uuid('id').primaryKey().defaultRandom(),
    campaignId:       uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
    userId:           uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

    // Platform + post data
    platform:         varchar('platform', { length: 50 }).notNull(),
    postUrl:          text('post_url').notNull(),
    postText:         text('post_text').notNull(),
    postPublishedAt:  timestamp('post_published_at', { withTimezone: true }).notNull(),
    postEngagement:   integer('post_engagement').default(0).notNull(),

    // AI classification
    intentType:          intentTypeEnum('intent_type').notNull(),
    intentConfidence:    decimal('intent_confidence', { precision: 4, scale: 3 }).notNull(),
    intentJustification: text('intent_justification').notNull(),
    urgencyScore:        decimal('urgency_score',       { precision: 4, scale: 3 }).default('0').notNull(),
    personaMatchScore:   decimal('persona_match_score', { precision: 4, scale: 3 }).default('0').notNull(),

    // Identity (extracted by NER)
    name:               varchar('name', { length: 255 }),
    username:           varchar('username', { length: 255 }).notNull(),
    platformProfileUrl: text('platform_profile_url').notNull(),
    jobTitle:           varchar('job_title', { length: 255 }),
    company:            varchar('company', { length: 255 }),
    companyDomain:      varchar('company_domain', { length: 255 }),
    location:           varchar('location', { length: 255 }),
    industry:           varchar('industry', { length: 255 }),
    companySize:        varchar('company_size', { length: 50 }),

    // Enriched contact data
    email:          varchar('email', { length: 255 }),
    emailStatus:    emailStatusEnum('email_status'),
    emailProvider:  varchar('email_provider', { length: 100 }),
    phone:          varchar('phone', { length: 50 }),
    phoneStatus:    phoneStatusEnum('phone_status'),
    linkedinUrl:    text('linkedin_url'),

    // Score
    leadScore: integer('lead_score').default(0).notNull(),
    scoreTier: scoreTierEnum('score_tier').notNull(),

    // Status
    status:        leadStatusEnum('lead_status').default('pending').notNull(),
    crmPushedAt:   timestamp('crm_pushed_at', { withTimezone: true }),
    crmRecordUrl:  text('crm_record_url'),

    // Compliance
    complianceGdprSafe: boolean('compliance_gdpr_safe').default(true).notNull(),
    complianceDpdpSafe: boolean('compliance_dpdp_safe').default(true).notNull(),

    // Timestamps
    createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    enrichedAt: timestamp('enriched_at', { withTimezone: true }),
  },
  (t) => ({
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
