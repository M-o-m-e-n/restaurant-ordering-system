import { Request, Response } from 'express';
import { queueService } from '../services/queue.service';
import { asyncHandler } from '../middlewares/error.middleware';

export class SyncController {
  /**
   * Sync offline orders
   * POST /api/sync/orders
   */
  syncOrders = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { orders } = req.body;

    const results = await queueService.syncOrders(userId, orders);

    res.json({
      success: true,
      message: 'Orders synced',
      data: {
        total: orders.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      },
    });
  });

  /**
   * Get queue status (admin only)
   * GET /api/sync/queue/status
   */
  getQueueStatus = asyncHandler(async (req: Request, res: Response) => {
    const length = await queueService.getQueueLength();

    res.json({
      success: true,
      data: {
        queueLength: length,
      },
    });
  });

  /**
   * Process queue (admin only)
   * POST /api/sync/queue/process
   */
  processQueue = asyncHandler(async (req: Request, res: Response) => {
    const results = await queueService.processQueue();

    res.json({
      success: true,
      message: 'Queue processed',
      data: {
        processed: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      },
    });
  });

  /**
   * Clear queue (admin only)
   * DELETE /api/sync/queue
   */
  clearQueue = asyncHandler(async (req: Request, res: Response) => {
    await queueService.clearQueue();

    res.json({
      success: true,
      message: 'Queue cleared',
    });
  });
}

export const syncController = new SyncController();
export default syncController;

