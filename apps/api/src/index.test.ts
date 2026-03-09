import { describe, it, expect } from 'vitest'
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
