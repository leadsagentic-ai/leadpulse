/**
 * Truncate a string to a maximum length, appending an ellipsis if truncated.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return `${str.slice(0, maxLength - 3)}...`
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Chunk an array into sub-arrays of a given size.
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

/**
 * Remove duplicate values from an array.
 */
export function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)]
}

/**
 * Extract domain from a URL string. Returns null on invalid input.
 */
export function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * Build a URL with query params, filtering out undefined/null values.
 */
export function buildUrl(base: string, params: Record<string, string | number | boolean | null | undefined>): string {
  const url = new URL(base)
  for (const [key, value] of Object.entries(params)) {
    if (value != null) {
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

/**
 * Calculate pagination metadata.
 */
export function paginate(total: number, page: number, limit: number) {
  const totalPages = Math.ceil(total / limit)
  return {
    page,
    limit,
    total,
    totalPages,
    hasMore: page < totalPages,
  }
}

/**
 * Safely parse JSON, returning null on failure.
 */
export function safeJsonParse<T = unknown>(json: string): T | null {
  try {
    return JSON.parse(json) as T
  } catch {
    return null
  }
}

/**
 * Format a score (0–100) into a human-readable tier label.
 */
export function scoreTierLabel(score: number): string {
  if (score >= 80) return 'HOT'
  if (score >= 60) return 'WARM'
  if (score >= 40) return 'COOL'
  if (score >= 20) return 'WEAK'
  return 'DISCARD'
}

/**
 * Retry an async function with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 500,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts) {
        await sleep(baseDelayMs * 2 ** (attempt - 1))
      }
    }
  }
  throw lastError
}
