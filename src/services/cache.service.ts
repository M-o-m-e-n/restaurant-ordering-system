import redis from '../config/redis';
import { logger } from '../config/logger';
import config from '../config';

export class CacheService {
  /**
   * Get cached data
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set cached data with TTL
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await redis.setex(key, ttl, serialized);
      } else {
        await redis.set(key, serialized);
      }
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  /**
   * Delete cached data
   */
  async delete(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  }

  /**
   * Delete cached data by pattern
   * Uses SCAN to avoid blocking Redis on large keyspaces.
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', '200');
        cursor = result[0];
        const keys = result[1] as string[];

        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== '0');
    } catch (error) {
      logger.error('Cache delete pattern error:', error);
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      return (await redis.exists(key)) === 1;
    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  }

  // Cache key generators
  static keys = {
    menu: (restaurantId: string) => `menu:${restaurantId}`,
    menuItem: (itemId: string) => `menu:item:${itemId}`,
    categories: (restaurantId: string) => `categories:${restaurantId}`,
    user: (userId: string) => `user:${userId}`,
    order: (orderId: string) => `order:${orderId}`,
  };

  // Get menu with caching
  async getMenu(restaurantId: string): Promise<any | null> {
    return this.get(CacheService.keys.menu(restaurantId));
  }

  // Set menu cache
  async setMenu(restaurantId: string, menu: any): Promise<void> {
    await this.set(CacheService.keys.menu(restaurantId), menu, config.cache.menuTTL);
  }

  // Invalidate menu cache
  async invalidateMenu(restaurantId: string): Promise<void> {
    await this.deletePattern(`menu:${restaurantId}*`);
    await this.deletePattern(`categories:${restaurantId}*`);
  }
}

export const cacheService = new CacheService();
export default cacheService;
