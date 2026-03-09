import {
  pgTable, pgEnum, uuid, varchar, text, integer,
  timestamp, index,
} from 'drizzle-orm/pg-core'
import { users } from './users.schema'

export const campaignStatusEnum   = pgEnum('campaign_status',   ['active', 'paused', 'archived'])
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
    personaFilter:     text('persona_filter'),
    geoFilter:         text('geo_filter').array().default([]).notNull(),
    notificationFreq:  notificationFreqEnum('notification_freq').default('daily').notNull(),
    status:            campaignStatusEnum('status').default('active').notNull(),
    createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index('campaigns_user_id_idx').on(t.userId),
    statusIdx: index('campaigns_status_idx').on(t.status),
  }),
)

export type Campaign    = typeof campaigns.$inferSelect
export type NewCampaign = typeof campaigns.$inferInsert
