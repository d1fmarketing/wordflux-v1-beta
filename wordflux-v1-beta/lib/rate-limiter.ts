import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  
  constructor(options: { windowMs?: number; maxRequests?: number } = {}) {
    this.windowMs = options.windowMs || 60000; // 1 minute default
    this.maxRequests = options.maxRequests || 30; // 30 requests per minute
    
    // Clean up old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }
  
  private cleanup() {
    const now = Date.now();
    Array.from(this.store.entries()).forEach(([key, entry]) => {
      if (entry.resetTime < now) {
        this.store.delete(key);
      }
    });
  }
  
  private getKey(request: NextRequest): string {
    // Try to get real IP from headers (for proxied requests)
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwarded?.split(',')[0] || realIp || 'unknown';
    return `rate-limit:${ip}`;
  }
  
  async check(request: NextRequest): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = this.getKey(request);
    const now = Date.now();
    
    let entry = this.store.get(key);
    
    if (!entry || entry.resetTime < now) {
      // New window
      entry = {
        count: 1,
        resetTime: now + this.windowMs
      };
      this.store.set(key, entry);
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetTime: entry.resetTime
      };
    }
    
    if (entry.count >= this.maxRequests) {
      // Rate limit exceeded
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime
      };
    }
    
    // Increment counter
    entry.count++;
    this.store.set(key, entry);
    
    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetTime: entry.resetTime
    };
  }
  
  createResponse(message: string, resetTime: number): NextResponse {
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
    
    return NextResponse.json(
      {
        ok: false,
        error: 'Too Many Requests',
        message,
        retryAfter
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(this.maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(resetTime),
          'Retry-After': String(retryAfter)
        }
      }
    );
  }
}

// Export singleton instance
export const chatRateLimiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 100 // allow generous headroom for automated tests
});

// Middleware function
export async function withRateLimit(
  request: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const { allowed, remaining, resetTime } = await chatRateLimiter.check(request);
  
  if (!allowed) {
    return chatRateLimiter.createResponse(
      'Rate limit exceeded. Please wait before making more requests.',
      resetTime
    );
  }
  
  // Add rate limit headers to successful response
  const response = await handler();
  response.headers.set('X-RateLimit-Limit', '30');
  response.headers.set('X-RateLimit-Remaining', String(remaining));
  response.headers.set('X-RateLimit-Reset', String(resetTime));
  
  return response;
}
