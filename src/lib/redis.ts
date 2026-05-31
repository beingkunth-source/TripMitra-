import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL || "";
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || "";

export const isRedisConfigured = !!(redisUrl && redisToken);

if (!isRedisConfigured) {
  console.warn(
    "Upstash Redis REST credentials are not configured. Rate limiting and JSON caching fallbacks are bypassed."
  );
}

// Safely instantiate Upstash Redis
export const redis = isRedisConfigured
  ? new Redis({ url: redisUrl, token: redisToken })
  : null;

/**
 * Safely get a value from Redis cache with error isolation
 */
export async function getCached<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const data = await redis.get(key);
    if (!data) return null;
    // Upstash client parsed strings/JSON automatically, but let's double check
    return typeof data === "string" ? JSON.parse(data) : (data as T);
  } catch (err) {
    console.error(`Redis get error for key [${key}]:`, err);
    return null;
  }
}

/**
 * Safely set a value in Redis cache with error isolation
 */
export async function setCached<T>(
  key: string,
  value: T,
  ttlSeconds = 86400 // Default 24 hours
): Promise<void> {
  if (!redis) return;
  try {
    const serialized = JSON.stringify(value);
    await redis.set(key, serialized, { ex: ttlSeconds });
  } catch (err) {
    console.error(`Redis set error for key [${key}]:`, err);
  }
}

/**
 * Upstash Redis-based rate limiting implementation for API routes
 * Returns true if the request is within limits, false otherwise.
 */
export async function checkRateLimit(
  ip: string,
  limit = 25, // default requests
  windowSeconds = 60 // window duration
): Promise<{ success: boolean; limit: number; remaining: number }> {
  if (!redis) {
    // If Redis is not configured, we allow the request (graceful failover)
    return { success: true, limit, remaining: limit };
  }

  try {
    const key = `tripmitra:ratelimit:${ip}`;
    const current = await redis.incr(key);

    if (current === 1) {
      // First request in window, set TTL
      await redis.expire(key, windowSeconds);
    }

    const remaining = Math.max(0, limit - current);
    const success = current <= limit;

    return { success, limit, remaining };
  } catch (err) {
    console.error(`Rate limiter exception for IP [${ip}]:`, err);
    // Allow the request on rate-limiting engine error
    return { success: true, limit, remaining: limit };
  }
}
