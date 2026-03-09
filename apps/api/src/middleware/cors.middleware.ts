import { createMiddleware } from 'hono/factory'
import { cors } from 'hono/cors'

// Restrict CORS to the configured frontend URL.
// In development FRONTEND_URL is http://localhost:5173.
export const corsMiddleware = createMiddleware<{
  Bindings: { FRONTEND_URL: string }
}>(async (c, next) => {
  const frontendUrl = c.env.FRONTEND_URL

  const handler = cors({
    origin: frontendUrl,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    credentials: true,
    maxAge: 3600,
  })

  return handler(c, next)
})
