import { Request, Response, NextFunction } from 'express';
import redis from '../config/redis';
import { logger } from '../config/logger';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  message?: string;
}

/**
 * Redis-backed rate limiting middleware
 */
export const rateLimiter = (options: RateLimitOptions) => {
  const {
    windowMs,
    max,
    keyPrefix = 'ratelimit',
    message = 'Too many requests, please try again later',
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = `${keyPrefix}:${req.ip}:${req.path}`;
      const windowSeconds = Math.ceil(windowMs / 1000);

      const current = await redis.incr(key);

      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }

      const ttl = await redis.ttl(key);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - current));
      res.setHeader('X-RateLimit-Reset', Date.now() + ttl * 1000);

      if (current > max) {
        res.status(429).json({
          success: false,
          error: {
            message,
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: ttl,
          },
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Rate limiter error:', error);
      // Fail open - allow request if Redis is down
      next();
    }
  };
};

// Pre-configured rate limiters
export const authRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes
  keyPrefix: 'ratelimit:auth',
  message: 'Too many authentication attempts, please try again later',
});

export const apiRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  keyPrefix: 'ratelimit:api',
});

export const strictRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  keyPrefix: 'ratelimit:strict',
  message: 'Rate limit exceeded for sensitive operation',
});

export default { rateLimiter, authRateLimiter, apiRateLimiter, strictRateLimiter };

