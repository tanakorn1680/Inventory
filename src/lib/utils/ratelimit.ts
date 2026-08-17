import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Rate limiter instances (lazy — only created if env vars exist)
let _chatLimiter: Ratelimit | null = null
let _apiLimiter: Ratelimit | null = null

function hasUpstash(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

function getChatLimiter(): Ratelimit | null {
  if (!hasUpstash()) return null
  if (!_chatLimiter) {
    _chatLimiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(20, '1 m'), // 20 requests per minute
      analytics: false,
      prefix: 'ai-office:chat',
    })
  }
  return _chatLimiter
}

function getApiLimiter(): Ratelimit | null {
  if (!hasUpstash()) return null
  if (!_apiLimiter) {
    _apiLimiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 API calls per minute
      analytics: false,
      prefix: 'ai-office:api',
    })
  }
  return _apiLimiter
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

export async function checkChatRateLimit(userId: string): Promise<RateLimitResult> {
  const limiter = getChatLimiter()
  if (!limiter) {
    // No Upstash configured — allow all
    return { success: true, limit: 20, remaining: 19, reset: Date.now() + 60_000 }
  }
  const result = await limiter.limit(userId)
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  }
}

export async function checkApiRateLimit(userId: string): Promise<RateLimitResult> {
  const limiter = getApiLimiter()
  if (!limiter) {
    return { success: true, limit: 100, remaining: 99, reset: Date.now() + 60_000 }
  }
  const result = await limiter.limit(userId)
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  }
}
