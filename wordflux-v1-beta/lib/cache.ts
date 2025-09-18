import Redis from 'ioredis'

const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: times => Math.min(times * 50, 2000)
})

export async function cacheGet<T>(key: string): Promise<T | null> {
  const value = await redis.get(key)
  return value ? (JSON.parse(value) as T) : null
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds = 60): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
}

export async function cacheDel(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern)
  if (keys.length > 0) {
    await redis.del(...keys)
  }
}

export { redis }
export default redis
