import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { authMiddleware } from './auth.middleware'

// Helper to build a minimal test app with auth middleware
function buildApp() {
  const app = new Hono<{
    Bindings: { FIREBASE_WEB_API_KEY: string }
    Variables: { userId: string; userEmail: string }
  }>()

  app.use('*', authMiddleware)
  app.get('/protected', (c) =>
    c.json({ userId: c.get('userId'), email: c.get('userEmail') }),
  )
  return app
}

const FAKE_API_KEY = 'test-firebase-key'
const VALID_TOKEN = 'valid-firebase-token'
const FIREBASE_LOOKUP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FAKE_API_KEY}`

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('authMiddleware', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const app = buildApp()
    const req = new Request('http://localhost/protected')
    const res = await app.fetch(req, { FIREBASE_WEB_API_KEY: FAKE_API_KEY })
    expect(res.status).toBe(401)
    const body = await res.json<{ error: { code: string } }>()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 when Authorization header is not Bearer', async () => {
    const app = buildApp()
    const req = new Request('http://localhost/protected', {
      headers: { Authorization: 'Basic sometoken' },
    })
    const res = await app.fetch(req, { FIREBASE_WEB_API_KEY: FAKE_API_KEY })
    expect(res.status).toBe(401)
  })

  it('returns 401 when Firebase lookup returns non-ok', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'INVALID_ID_TOKEN' } }), { status: 400 }),
    )
    const app = buildApp()
    const req = new Request('http://localhost/protected', {
      headers: { Authorization: `Bearer ${VALID_TOKEN}` },
    })
    const res = await app.fetch(req, { FIREBASE_WEB_API_KEY: FAKE_API_KEY })
    expect(res.status).toBe(401)
    expect(global.fetch).toHaveBeenCalledWith(
      FIREBASE_LOOKUP_URL,
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('returns 401 when Firebase returns empty users array', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ users: [] }), { status: 200 }),
    )
    const app = buildApp()
    const req = new Request('http://localhost/protected', {
      headers: { Authorization: `Bearer ${VALID_TOKEN}` },
    })
    const res = await app.fetch(req, { FIREBASE_WEB_API_KEY: FAKE_API_KEY })
    expect(res.status).toBe(401)
  })

  it('sets userId and userEmail on context for valid token', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ users: [{ localId: 'uid-123', email: 'user@test.com' }] }),
        { status: 200 },
      ),
    )
    const app = buildApp()
    const req = new Request('http://localhost/protected', {
      headers: { Authorization: `Bearer ${VALID_TOKEN}` },
    })
    const res = await app.fetch(req, { FIREBASE_WEB_API_KEY: FAKE_API_KEY })
    expect(res.status).toBe(200)
    const body = await res.json<{ userId: string; email: string }>()
    expect(body.userId).toBe('uid-123')
    expect(body.email).toBe('user@test.com')
  })
})
