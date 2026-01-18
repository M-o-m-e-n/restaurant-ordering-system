import Redis from 'ioredis';
import config from './index';
import { logger } from './logger';

class RedisClient {
  private static instance: Redis | null = null;

  static getInstance(): Redis {
    if (!RedisClient.instance) {
      RedisClient.instance = new Redis(config.redis.url, {
        // Allow commands to queue while Redis reconnects (avoids spammy failures on boot)
        enableOfflineQueue: true,
        lazyConnect: true,
        // Don't hard-fail quickly on temporary outages
        maxRetriesPerRequest: null,
      });

      RedisClient.instance.on('connect', () => {
        logger.info('Redis connected successfully');
      });

      // ioredis emits many error events while Redis is down; keep logs readable.
      RedisClient.instance.on('error', (err) => {
        logger.warn('Redis connection error:', { code: (err as any)?.code });
      });

      RedisClient.instance.on('close', () => {
        logger.warn('Redis connection closed');
      });

      RedisClient.instance.on('reconnecting', () => {
        logger.info('Redis reconnecting...');
      });
    }

    return RedisClient.instance;
  }

  static async disconnect(): Promise<void> {
    if (RedisClient.instance) {
      await RedisClient.instance.quit();
      RedisClient.instance = null;
    }
  }
}

export const redis = RedisClient.getInstance();
export default redis;
