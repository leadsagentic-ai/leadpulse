import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '@/middleware/auth.middleware'
import { createDb } from '@/db'
import { upsertUser, getUserById } from '@/services/user.service'
import { logger } from '@/lib/logger'

type HonoEnv = {
  Bindings: { DATABASE_URL: string; FIREBASE_WEB_API_KEY: string }
  Variables: { userId: string; userEmail: string }
}

const LoginSchema = z.object({
  fullName: z.string().min(1).max(255),
})

export const authRoutes = new Hono<HonoEnv>()
  // POST /api/v1/auth/login — called after client-side Firebase sign-in
  // Upserts the user in the DB and returns the user record
  .post('/login', authMiddleware, zValidator('json', LoginSchema), async (c) => {
    const firebaseUid = c.get('userId')
    const userEmail   = c.get('userEmail')
    const { fullName } = c.req.valid('json')

    const db = createDb(c.env.DATABASE_URL)
    const result = await upsertUser(db, firebaseUid, userEmail, fullName)

    if (result.isErr()) {
      logger.error({ err: result.error, firebaseUid }, 'Login upsert failed')
      return c.json(
        { success: false, error: result.error.toJSON() },
        result.error.statusCode as 500,
      )
    }

    return c.json({ success: true, data: result.value }, 200)
  })

  // GET /api/v1/auth/me — returns the current authenticated user
  .get('/me', authMiddleware, async (c) => {
    const firebaseUid = c.get('userId')

    const db = createDb(c.env.DATABASE_URL)
    const result = await getUserById(db, firebaseUid)

    if (result.isErr()) {
      return c.json(
        { success: false, error: result.error.toJSON() },
        result.error.statusCode as 404,
      )
    }

    return c.json({ success: true, data: result.value })
  })
