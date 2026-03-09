import pino from 'pino'

// Cloudflare Workers: pino outputs to console automatically
// NODE_ENV may not be available at module-load time via env.ts (Workers binding),
// so fall back to checking the global directly.
const isDev =
  typeof process !== 'undefined' && process.env['NODE_ENV'] !== 'production'

export const logger = pino({
  level: isDev ? 'debug' : 'info',
  base: { service: 'leadpulse-api' },
})
