import { describe, it, expect, vi } from 'vitest'

// validateWorkerEnv reads CF Worker bindings — not available in Vitest/Node.js.
// Mock it as a no-op so the health check test runs without real env vars.
vi.mock('@/lib/env', () => ({
  validateWorkerEnv: () => {},
}))

import { app } from './index'

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
