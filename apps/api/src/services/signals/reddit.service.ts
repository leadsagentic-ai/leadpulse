import ky from 'ky'
import { ok, err, type Result } from 'neverthrow'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis/cloudflare'
import { logger } from '@/lib/logger'
import { AppError, ExternalApiError, RateLimitedError } from '@/lib/errors'

// ── Types ──────────────────────────────────────────────────────

export interface RedditPost {
  id: string
  title: string
  selftext: string
  url: string
  author: string
  created_utc: number
  score: number
  num_comments: number
  subreddit: string
  permalink: string
}

interface RedditTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
}

interface RedditSearchResponse {
  data: {
    children: Array<{
      data: {
        id: string
        title: string
        selftext: string
        url: string
        author: string
        created_utc: number
        score: number
        num_comments: number
        subreddit: string
        permalink: string
      }
    }>
  }
}

// ── OAuth2 Token ───────────────────────────────────────────────

export async function getRedditAccessToken(
  clientId: string,
  secret: string,
  userAgent: string,
): Promise<Result<string, AppError>> {
  logger.info({ clientId }, 'Fetching Reddit access token')

  const credentials = btoa(`${clientId}:${secret}`)

  const response = await ky
    .post('https://www.reddit.com/api/v1/access_token', {
      headers: {
        Authorization: `Basic ${credentials}`,
        'User-Agent': userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      timeout: 10_000,
      throwHttpErrors: false,
    })
    .json<RedditTokenResponse | { error: string }>()
    .catch((e: Error) => {
      logger.error({ err: e }, 'Reddit token request failed (network)')
      return null
    })

  if (!response) {
    return err(new ExternalApiError('reddit', 'Token request failed'))
  }

  if ('error' in response) {
    logger.warn({ error: response.error }, 'Reddit OAuth2 error')
    return err(new ExternalApiError('reddit', `OAuth2 error: ${response.error}`))
  }

  logger.info({ expiresIn: response.expires_in }, 'Reddit access token obtained')
  return ok(response.access_token)
}

// ── Post Search ────────────────────────────────────────────────

export async function searchRedditPosts(
  query: string,
  subreddits: string[],
  accessToken: string,
  userAgent: string,
  limit = 25,
  options?: {
    upstashRedisRestUrl: string
    upstashRedisRestToken: string
  },
): Promise<Result<RedditPost[], AppError>> {
  // Apply Upstash rate limit if Redis creds are provided
  if (options) {
    const redis = new Redis({
      url: options.upstashRedisRestUrl,
      token: options.upstashRedisRestToken,
    })
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '60 s'),
      prefix: 'leadpulse:reddit:rl',
    })
    const { success } = await ratelimit.limit('reddit-search')
    if (!success) {
      logger.warn({ query }, 'Reddit search rate limit exceeded')
      return err(new RateLimitedError('reddit'))
    }
  }

  // Build search URL — restrict to specified subreddits if provided
  const searchUrl = subreddits.length > 0
    ? `https://oauth.reddit.com/r/${subreddits.join('+')}/search.json`
    : 'https://oauth.reddit.com/search.json'

  logger.info({ query, subreddits, limit }, 'Searching Reddit posts')

  const response = await ky
    .get(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': userAgent,
      },
      searchParams: {
        q: query,
        limit: String(Math.min(limit, 100)),
        sort: 'relevance',
        t: 'week',
        type: 'link',
        ...(subreddits.length === 0 ? {} : { restrict_sr: 'true' }),
      },
      timeout: 15_000,
      throwHttpErrors: false,
    })
    .json<RedditSearchResponse | { error: string; message?: string }>()
    .catch((e: Error) => {
      logger.error({ err: e, query }, 'Reddit search request failed (network)')
      return null
    })

  if (!response) {
    return err(new ExternalApiError('reddit', 'Search request failed'))
  }

  if ('error' in response) {
    logger.warn({ error: response.error, query }, 'Reddit search API error')
    return err(new ExternalApiError('reddit', response.message ?? response.error))
  }

  const posts: RedditPost[] = response.data.children.map(({ data }) => ({
    id:           data.id,
    title:        data.title,
    selftext:     data.selftext ?? '',
    url:          data.url,
    author:       data.author,
    created_utc:  data.created_utc,
    score:        data.score,
    num_comments: data.num_comments,
    subreddit:    data.subreddit,
    permalink:    data.permalink,
  }))

  logger.info({ query, count: posts.length }, 'Reddit search complete')
  return ok(posts)
}
