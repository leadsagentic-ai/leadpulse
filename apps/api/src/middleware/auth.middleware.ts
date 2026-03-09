import { createMiddleware } from 'hono/factory'
import { logger } from '@/lib/logger'

// Firebase JWT verification via REST API.
// The full Firebase Admin SDK requires Node.js and doesn't work in Cloudflare Workers.
export const authMiddleware = createMiddleware<{
  Bindings: { FIREBASE_WEB_API_KEY: string }
  Variables: { userId: string; userEmail: string }
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' } },
      401,
    )
  }

  const token = authHeader.slice(7)

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${c.env.FIREBASE_WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    },
  )

  if (!response.ok) {
    logger.warn({ status: response.status }, 'Firebase token verification failed')
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } },
      401,
    )
  }

  const data = await response.json<{ users?: Array<{ localId: string; email: string }> }>()

  if (!data.users?.length) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'User not found' } },
      401,
    )
  }

  const user = data.users[0]
  c.set('userId', user.localId)
  c.set('userEmail', user.email ?? '')

  await next()
})
