import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

const envSchema = {
  server: {
    DATABASE_URL:             z.string().url(),
    // Optional in local dev — dedup/rate-limiting skipped when absent
    UPSTASH_REDIS_REST_URL:   z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(20).optional(),
    FIREBASE_WEB_API_KEY:     z.string().min(10),
    ML_SERVICE_URL:           z.string().url(),
    ML_SERVICE_SECRET:        z.string().min(20),
    HUNTER_API_KEY:           z.string().min(10).optional(),
    // Optional — Sprint 8 enrichment providers
    APOLLO_API_KEY:           z.string().min(10).optional(),
    PDL_API_KEY:              z.string().min(10).optional(),
    PROXYCURL_API_KEY:        z.string().min(10).optional(),
    // Optional — Sprint 8 (email) and Sprint 9 (billing) features
    RESEND_API_KEY:           z.string().startsWith('re_').optional(),
    RAZORPAY_KEY_ID:          z.string().startsWith('rzp_').optional(),
    RAZORPAY_KEY_SECRET:      z.string().min(10).optional(),
    FRONTEND_URL:             z.string().url(),
    ENCRYPTION_KEY:           z.string().length(32),
    // Optional — Sentry error monitoring (Sprint 7)
    SENTRY_DSN:               z.string().url().optional(),
    NODE_ENV:                 z.enum(['development', 'test', 'production']).default('development'),
  },
}

/**
 * Validates Cloudflare Worker bindings at request time.
 *
 * In CF Workers, .dev.vars values live in the worker's `env` object (c.env.*),
 * NOT in process.env. Call this from a Hono startup middleware with c.env.
 */
export function validateWorkerEnv(bindings: Record<string, string | undefined>) {
  return createEnv({
    ...envSchema,
    runtimeEnv: bindings,
    skipValidation: false,
    emptyStringAsUndefined: true,
  })
}

export type WorkerEnv = ReturnType<typeof validateWorkerEnv>
