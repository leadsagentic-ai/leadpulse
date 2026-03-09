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

export type Workspace       = typeof workspaces.$inferSelect
export type WorkspaceMember = typeof workspaceMembers.$inferSelect
