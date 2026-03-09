import {
  pgTable, pgEnum, uuid, varchar, text, jsonb,
  boolean, timestamp, index,
} from 'drizzle-orm/pg-core'
import { users } from './users.schema'

export const crmTypeEnum           = pgEnum('crm_type',           ['hubspot', 'salesforce', 'zoho', 'pipedrive', 'webhook', 'make'])
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
