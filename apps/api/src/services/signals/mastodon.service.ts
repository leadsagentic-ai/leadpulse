import ky from 'ky'
import { ok, err, type Result } from 'neverthrow'
import { logger } from '@/lib/logger'
import { AppError, ExternalApiError } from '@/lib/errors'

// ── Types ──────────────────────────────────────────────────────

export interface MastodonStatus {
  id:              string
  url:             string
  content:         string   // raw HTML from Mastodon
  plainText:       string   // HTML stripped for NLP / display
  author:          string   // acct like "user@mastodon.social"
  authorUrl:       string
  createdAt:       string   // ISO 8601
  repliesCount:    number
  reblogsCount:    number
  favouritesCount: number
}

interface MastodonSearchResponse {
  statuses: Array<{
    id:              string
    url:             string
    content:         string
    created_at:      string
    account: {
      acct:          string
      url:           string
      display_name?: string
    }
    replies_count:    number
    reblogs_count:    number
    favourites_count: number
  }>
}

// ── HTML stripping ─────────────────────────────────────────────

/**
 * Converts Mastodon HTML content to plain text.
 * Mastodon wraps posts in <p> tags and uses <br> for line breaks.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

// ── Post Search ────────────────────────────────────────────────

/**
 * Searches Mastodon public posts by keyword using the v2 search API.
 * No authentication required for public search.
 *
 * @param query    - Keyword to search for
 * @param instance - Mastodon instance base URL (default: https://mastodon.social)
 * @param limit    - Max statuses to return (max 40 per Mastodon API)
 */
export async function searchMastodonPosts(
  query: string,
  instance = 'https://mastodon.social',
  limit = 25,
): Promise<Result<MastodonStatus[], AppError>> {
  logger.info({ query, instance, limit }, 'Searching Mastodon posts')

  const response = await ky
    .get(`${instance}/api/v2/search`, {
      searchParams: {
        q:       query,
        type:    'statuses',
        resolve: 'false',
        limit:   String(Math.min(limit, 40)), // Mastodon hard max is 40
      },
      timeout: 15_000,
      throwHttpErrors: false,
    })
    .json<MastodonSearchResponse | { error: string }>()
    .catch((e: Error) => {
      logger.error({ err: e, query, instance }, 'Mastodon search request failed (network)')
      return null
    })

  if (!response) {
    return err(new ExternalApiError('mastodon', 'Search request failed'))
  }

  if ('error' in response) {
    logger.warn({ error: response.error, query }, 'Mastodon search API error')
    return err(new ExternalApiError('mastodon', response.error))
  }

  const statuses: MastodonStatus[] = response.statuses.map((s) => ({
    id:              s.id,
    url:             s.url,
    content:         s.content,
    plainText:       stripHtml(s.content),
    author:          s.account.acct,
    authorUrl:       s.account.url,
    createdAt:       s.created_at,
    repliesCount:    s.replies_count,
    reblogsCount:    s.reblogs_count,
    favouritesCount: s.favourites_count,
  }))

  logger.info({ query, instance, count: statuses.length }, 'Mastodon search complete')
  return ok(statuses)
}
