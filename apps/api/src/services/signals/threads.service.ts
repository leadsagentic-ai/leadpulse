import ky from 'ky'
import { ok, err, type Result } from 'neverthrow'
import { logger } from '@/lib/logger'
import { AppError, ExternalApiError } from '@/lib/errors'

// ── Types ──────────────────────────────────────────────────────

export interface ThreadsPost {
  id:         string
  text:       string
  username:   string
  permalink:  string
  createdAt:  string  // ISO 8601
  url:        string
  likeCount:  number
  replyCount: number
}

interface ThreadsKeywordSearchResponse {
  data: Array<{
    id:             string
    text?:          string
    permalink?:     string
    timestamp?:     string
    username?:      string
    likes_count?:   number
    replies_count?: number
  }>
  paging?: {
    cursors?: { before: string; after: string }
    next?:    string
  }
}

interface ThreadsApiError {
  error: {
    message: string
    type:    string
    code:    number
  }
}

// ── Post Search ────────────────────────────────────────────────

/**
 * Searches Threads posts by keyword using the Meta Threads Graph API.
 * Requires a Threads API access token.
 *
 * Note: Per-user OAuth tokens are stored encrypted in the integrations table
 * and will be retrieved via the integrations service once the OAuth connect
 * flow is built in Sprint 6. For now a single env-level token is used.
 *
 * https://developers.facebook.com/docs/threads
 */
export async function searchThreadsPosts(
  query: string,
  accessToken: string,
  limit = 25,
): Promise<Result<ThreadsPost[], AppError>> {
  logger.info({ query, limit }, 'Searching Threads posts')

  const response = await ky
    .get('https://graph.threads.net/v1.0/keyword_search', {
      searchParams: {
        q:            query,
        fields:       'id,text,permalink,timestamp,username,likes_count,replies_count',
        limit:        String(Math.min(limit, 100)),
        access_token: accessToken,
      },
      timeout: 15_000,
      throwHttpErrors: false,
    })
    .json<ThreadsKeywordSearchResponse | ThreadsApiError>()
    .catch((e: Error) => {
      logger.error({ err: e, query }, 'Threads search request failed (network)')
      return null
    })

  if (!response) {
    return err(new ExternalApiError('threads', 'Search request failed'))
  }

  if ('error' in response) {
    logger.warn({ error: response.error.message, query }, 'Threads API error')
    return err(new ExternalApiError('threads', response.error.message))
  }

  const posts: ThreadsPost[] = response.data
    .filter((item) => !!item.text)
    .map((item) => {
      const permalink = item.permalink ?? `https://www.threads.net/@${item.username ?? 'unknown'}`
      return {
        id:         item.id,
        text:       item.text        ?? '',
        username:   item.username    ?? '',
        permalink,
        createdAt:  item.timestamp   ?? new Date().toISOString(),
        url:        permalink,
        likeCount:  item.likes_count   ?? 0,
        replyCount: item.replies_count ?? 0,
      }
    })

  logger.info({ query, count: posts.length }, 'Threads search complete')
  return ok(posts)
}
