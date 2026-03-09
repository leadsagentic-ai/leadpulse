import ky from 'ky'
import { ok, err, type Result } from 'neverthrow'
import { logger } from '@/lib/logger'
import { AppError, ExternalApiError } from '@/lib/errors'

// ── Types ──────────────────────────────────────────────────────

export interface BlueskyPost {
  uri:         string   // at://did:plc:.../app.bsky.feed.post/rkey
  cid:         string
  text:        string
  author:      string   // handle e.g. "alice.bsky.social"
  authorDid:   string   // did:plc:...
  createdAt:   string   // ISO 8601
  likeCount:   number
  repostCount: number
  replyCount:  number
  url:         string   // https://bsky.app/profile/{handle}/post/{rkey}
}

interface BlueskySearchResponse {
  posts: Array<{
    uri:    string
    cid:    string
    author: {
      did:          string
      handle:       string
      displayName?: string
    }
    record: {
      text:      string
      createdAt: string
      '$type':   string
    }
    likeCount?:   number
    repostCount?: number
    replyCount?:  number
  }>
  cursor?: string
}

// ── Post Search ────────────────────────────────────────────────

/**
 * Searches Bluesky posts via the public AT Protocol Lexicon API.
 * No authentication is required — uses the public AppView endpoint.
 * https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts
 */
export async function searchBlueskyPosts(
  query: string,
  limit = 25,
): Promise<Result<BlueskyPost[], AppError>> {
  logger.info({ query, limit }, 'Searching Bluesky posts')

  const response = await ky
    .get('https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts', {
      searchParams: {
        q:     query,
        limit: String(Math.min(limit, 100)),
        sort:  'latest',
      },
      timeout: 15_000,
      throwHttpErrors: false,
    })
    .json<BlueskySearchResponse | { error: string; message?: string }>()
    .catch((e: Error) => {
      logger.error({ err: e, query }, 'Bluesky search request failed (network)')
      return null
    })

  if (!response) {
    return err(new ExternalApiError('bluesky', 'Search request failed'))
  }

  if ('error' in response) {
    logger.warn({ error: response.error, query }, 'Bluesky search API error')
    return err(new ExternalApiError('bluesky', response.message ?? response.error))
  }

  const posts: BlueskyPost[] = response.posts.map((post) => {
    // Build web URL from AT URI: at://did:plc:xxx/app.bsky.feed.post/rkey
    const rkey = post.uri.split('/').pop() ?? ''
    return {
      uri:         post.uri,
      cid:         post.cid,
      text:        post.record.text,
      author:      post.author.handle,
      authorDid:   post.author.did,
      createdAt:   post.record.createdAt,
      likeCount:   post.likeCount   ?? 0,
      repostCount: post.repostCount ?? 0,
      replyCount:  post.replyCount  ?? 0,
      url:         `https://bsky.app/profile/${post.author.handle}/post/${rkey}`,
    }
  })

  logger.info({ query, count: posts.length }, 'Bluesky search complete')
  return ok(posts)
}
