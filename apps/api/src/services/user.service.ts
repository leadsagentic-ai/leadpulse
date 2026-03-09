import { eq } from 'drizzle-orm'
import { ok, err, type Result } from 'neverthrow'
import { users } from '@/db/schema/users.schema'
import type { User, NewUser } from '@/db/schema/users.schema'
import { workspaces } from '@/db/schema/workspaces.schema'
import type { Database } from '@/db'
import { NotFoundError, AppError } from '@/lib/errors'
import { logger } from '@/lib/logger'

export async function upsertUser(
  db: Database,
  firebaseUid: string,
  email: string,
  fullName: string,
): Promise<Result<User, AppError>> {
  logger.info({ firebaseUid, email }, 'Upserting user on login')

  // Check if user already exists
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.firebaseUid, firebaseUid))
    .limit(1)

  if (existing) {
    // Update last login
    const [updated] = await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.firebaseUid, firebaseUid))
      .returning()

    if (!updated) {
      return err(new AppError('INTERNAL_ERROR', 'Failed to update user login time', 500))
    }

    logger.info({ userId: updated.id }, 'Existing user logged in')
    return ok(updated)
  }

  // New user — create a default workspace first
  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: `${fullName}'s Workspace`,
      ownerUserId: 'pending', // will update after user creation
      planTier: 'starter',
    })
    .returning()

  if (!workspace) {
    return err(new AppError('INTERNAL_ERROR', 'Failed to create workspace', 500))
  }

  const newUser: NewUser = {
    firebaseUid,
    email,
    fullName,
    planTier: 'starter',
    workspaceId: workspace.id,
    monthlyLeadQuota: 200,
    leadsUsedThisMonth: 0,
  }

  const [created] = await db.insert(users).values(newUser).returning()

  if (!created) {
    return err(new AppError('INTERNAL_ERROR', 'Failed to create user', 500))
  }

  // Update workspace owner to the real user id
  await db
    .update(workspaces)
    .set({ ownerUserId: created.id })
    .where(eq(workspaces.id, workspace.id))

  logger.info({ userId: created.id, workspaceId: workspace.id }, 'New user created')
  return ok(created)
}

export async function getUserById(
  db: Database,
  userId: string,
): Promise<Result<User, AppError>> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

  if (!user) {
    return err(new NotFoundError('User'))
  }

  return ok(user)
}

export async function getUserByFirebaseUid(
  db: Database,
  firebaseUid: string,
): Promise<Result<User, AppError>> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.firebaseUid, firebaseUid))
    .limit(1)

  if (!user) {
    return err(new NotFoundError('User'))
  }

  return ok(user)
}
