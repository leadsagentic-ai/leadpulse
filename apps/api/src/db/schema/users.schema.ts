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
