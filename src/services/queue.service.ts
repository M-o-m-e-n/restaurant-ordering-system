import redis from '../config/redis';
import { logger } from '../config/logger';
import prisma from '../config/database';
import { orderService } from './order.service';

interface QueuedOrder {
  clientId: string;
  userId: string;
  restaurantId: string;
  deliveryAddress: string;
  notes?: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    notes?: string;
  }>;
  createdAt: string;
}

interface QueueResult {
  clientId: string;
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  error?: string;
}

export class QueueService {
  private readonly QUEUE_KEY = 'order:queue';
  private readonly PROCESSING_KEY = 'order:processing';
  private isProcessing = false;

  /**
   * Add orders to queue for processing
   */
  async enqueueOrders(userId: string, orders: QueuedOrder[]): Promise<void> {
    for (const order of orders) {
      const queueItem = JSON.stringify({ ...order, userId });
      await redis.rpush(this.QUEUE_KEY, queueItem);
    }
    logger.info(`Enqueued ${orders.length} orders for user ${userId}`);
  }

  /**
   * Process orders from queue (FIFO)
   */
  async processQueue(): Promise<QueueResult[]> {
    if (this.isProcessing) {
      logger.debug('Queue is already being processed');
      return [];
    }

    this.isProcessing = true;
    const results: QueueResult[] = [];

    try {
      while (true) {
        // Move item from queue to processing
        const item = await redis.lpop(this.QUEUE_KEY);

        if (!item) {
          break; // Queue is empty
        }

        await redis.set(this.PROCESSING_KEY, item);

        try {
          const order: QueuedOrder & { userId: string } = JSON.parse(item);

          // Process the order
          const createdOrder = await orderService.createOrder(order.userId, {
            restaurantId: order.restaurantId,
            deliveryAddress: order.deliveryAddress,
            notes: order.notes,
            items: order.items,
          });

          results.push({
            clientId: order.clientId,
            success: true,
            orderId: createdOrder.id,
            orderNumber: createdOrder.orderNumber,
          });

          logger.info(`Processed queued order: ${createdOrder.orderNumber}`);
        } catch (error: any) {
          const order = JSON.parse(item);
          results.push({
            clientId: order.clientId,
            success: false,
            error: error.message,
          });
          logger.error(`Failed to process queued order:`, error);
        } finally {
          await redis.del(this.PROCESSING_KEY);
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return results;
  }

  /**
   * Sync orders from offline clients
   */
  async syncOrders(
    userId: string,
    orders: Array<{
      clientId: string;
      restaurantId: string;
      deliveryAddress: string;
      notes?: string;
      items: Array<{
        menuItemId: string;
        quantity: number;
        notes?: string;
      }>;
      createdAt: string;
    }>
  ): Promise<QueueResult[]> {
    // Sort orders by createdAt (FIFO)
    const sortedOrders = [...orders].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const results: QueueResult[] = [];

    for (const order of sortedOrders) {
      try {
        // Check for duplicate (by clientId)
        const existingKey = `order:client:${userId}:${order.clientId}`;
        const existing = await redis.get(existingKey);

        if (existing) {
          // Order was already processed
          const existingOrder = JSON.parse(existing);
          results.push({
            clientId: order.clientId,
            success: true,
            orderId: existingOrder.orderId,
            orderNumber: existingOrder.orderNumber,
          });
          continue;
        }

        // Process order
        const createdOrder = await orderService.createOrder(userId, {
          restaurantId: order.restaurantId,
          deliveryAddress: order.deliveryAddress,
          notes: order.notes,
          items: order.items,
        });

        // Store client ID mapping (expires in 24 hours)
        await redis.setex(
          existingKey,
          86400,
          JSON.stringify({
            orderId: createdOrder.id,
            orderNumber: createdOrder.orderNumber,
          })
        );

        results.push({
          clientId: order.clientId,
          success: true,
          orderId: createdOrder.id,
          orderNumber: createdOrder.orderNumber,
        });
      } catch (error: any) {
        results.push({
          clientId: order.clientId,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Get queue length
   */
  async getQueueLength(): Promise<number> {
    return redis.llen(this.QUEUE_KEY);
  }

  /**
   * Clear queue (admin only)
   */
  async clearQueue(): Promise<void> {
    await redis.del(this.QUEUE_KEY);
    await redis.del(this.PROCESSING_KEY);
    logger.warn('Order queue cleared');
  }
}

export const queueService = new QueueService();
export default queueService;

