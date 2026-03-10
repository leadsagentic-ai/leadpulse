import { describe, it, expect, vi } from 'vitest'

// hunter.service.ts (now reachable from index.ts) imports @/lib/env eagerly;
// mock it so the health check test doesn't need real env vars.
vi.mock('@/lib/env', () => ({
  env: { HUNTER_API_KEY: 'test-key' },
}))

import app from './index'

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const req = new Request('http://localhost/health')
    const res = await app.fetch(req)

    expect(res.status).toBe(200)

    const body = await res.json() as { status: string; timestamp: string }
    expect(body.status).toBe('ok')
    expect(typeof body.timestamp).toBe('string')
  })
})
