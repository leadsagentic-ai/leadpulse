import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

// Factory function — creates a new connection per Worker request
// Workers are stateless — no connection pooling is needed or possible
export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl)
  return drizzle(sql, { schema, logger: false })
}

export type Database = ReturnType<typeof createDb>
