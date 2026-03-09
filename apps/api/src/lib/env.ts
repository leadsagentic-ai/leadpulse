import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
  server: {
    DATABASE_URL:             z.string().url(),
    UPSTASH_REDIS_REST_URL:   z.string().url(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(20),
    FIREBASE_WEB_API_KEY:     z.string().min(10),
    ML_SERVICE_URL:           z.string().url(),
    ML_SERVICE_SECRET:        z.string().min(20),
    HUNTER_API_KEY:           z.string().min(10),
    RESEND_API_KEY:           z.string().startsWith('re_'),
    RAZORPAY_KEY_ID:          z.string().startsWith('rzp_'),
    RAZORPAY_KEY_SECRET:      z.string().min(10),
    FRONTEND_URL:             z.string().url(),
    ENCRYPTION_KEY:           z.string().length(32),
    NODE_ENV:                 z.enum(['development', 'test', 'production']).default('development'),
  },
  // In Cloudflare Workers, env vars come from Worker bindings — not process.env
  runtimeEnv: typeof process !== 'undefined' ? process.env : {},
  skipValidation: false,
  emptyStringAsUndefined: true,
})

export type Env = typeof env
