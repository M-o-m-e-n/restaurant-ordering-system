import { Request, Response } from 'express';
import { deliveryService } from '../services/delivery.service';
import { notificationService } from '../services/notification.service';
import { asyncHandler } from '../middlewares/error.middleware';
import { getIO } from '../sockets';

export class DeliveryController {
  /**
   * Assign driver to order
   * POST /api/deliveries/assign/:orderId
   */
  assignDriver = asyncHandler(async (req: Request, res: Response) => {
    const orderId = req.params.orderId as string;
    const { driverId, estimatedTime } = req.body;

    const delivery = await deliveryService.assignDriver(orderId, driverId, estimatedTime);

    // Emit socket events
    const io = getIO();
    if (io) {
      io.to(`order:${orderId}`).emit('delivery:assigned', {
        deliveryId: delivery.id,
        driver: delivery.driver,
      });
      io.to(`driver:${driverId}`).emit('delivery:assigned', {
        deliveryId: delivery.id,
        order: delivery.order,
      });
    }

    // Notify driver
    await notificationService.notifyDriverAssignment(delivery.id, orderId, driverId);

    res.status(201).json({
      success: true,
      message: 'Driver assigned successfully',
      data: delivery,
    });
  });

  /**
   * Update delivery status
   * PATCH /api/deliveries/:deliveryId/status
   */
  updateDeliveryStatus = asyncHandler(async (req: Request, res: Response) => {
    const deliveryId = req.params.deliveryId as string;
    const { status } = req.body;

    const delivery = await deliveryService.updateDeliveryStatus(deliveryId, status);

    // Emit socket event
    const io = getIO();
    if (io) {
      io.to(`order:${delivery.orderId}`).emit('delivery:status-changed', {
        deliveryId: delivery.id,
        status: delivery.status,
      });
    }

    // Notify customer
    if (delivery.order.user.fcmToken) {
      await notificationService.sendPushNotification(delivery.order.user.fcmToken, {
        title: 'Delivery Update',
        body: `Your delivery is now ${status.toLowerCase().replace('_', ' ')}`,
        data: {
          type: 'delivery_status',
          deliveryId,
          status,
        },
      });
    }

    res.json({
      success: true,
      message: 'Delivery status updated',
      data: delivery,
    });
  });

  /**
   * Update driver location
   * POST /api/deliveries/location
   */
  updateDriverLocation = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { latitude, longitude } = req.body;

    // Get driver ID from user
    const driver = await deliveryService.getDriverByUserId(userId);

    const result = await deliveryService.updateDriverLocation(driver.id, latitude, longitude);

    // Emit location update to active delivery
    const activeDelivery = await deliveryService.getActiveDelivery(driver.id);
    if (activeDelivery) {
      const io = getIO();
      if (io) {
        io.to(`order:${activeDelivery.orderId}`).emit('delivery:location-update', {
          deliveryId: activeDelivery.id,
          latitude,
          longitude,
        });
      }
    }

    res.json({
      success: true,
      ...result,
    });
  });

  /**
   * Get delivery by ID
   * GET /api/deliveries/:deliveryId
   */
  getDeliveryById = asyncHandler(async (req: Request, res: Response) => {
    const delivery = await deliveryService.getDeliveryById(req.params.deliveryId as string);

    res.json({
      success: true,
      data: delivery,
    });
  });

  /**
   * Get deliveries with filtering
   * GET /api/deliveries
   */
  getDeliveries = asyncHandler(async (req: Request, res: Response) => {
    const { driverId, status, startDate, endDate, page, limit } = req.query;

    const result = await deliveryService.getDeliveries({
      driverId: driverId as string,
      status: status as any,
      startDate: startDate as string,
      endDate: endDate as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      data: result.deliveries,
      pagination: result.pagination,
    });
  });

  /**
   * Get available drivers
   * GET /api/deliveries/drivers/available
   */
  getAvailableDrivers = asyncHandler(async (req: Request, res: Response) => {
    const { lat, lng } = req.query;

    const drivers = await deliveryService.getAvailableDrivers(
      lat ? parseFloat(lat as string) : undefined,
      lng ? parseFloat(lng as string) : undefined
    );

    res.json({
      success: true,
      data: drivers,
    });
  });

  /**
   * Update driver availability
   * PATCH /api/deliveries/drivers/availability
   */
  updateDriverAvailability = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { isAvailable } = req.body;

    const driver = await deliveryService.getDriverByUserId(userId);
    const updated = await deliveryService.updateDriverAvailability(driver.id, isAvailable);

    res.json({
      success: true,
      message: `Driver is now ${isAvailable ? 'available' : 'unavailable'}`,
      data: updated,
    });
  });

  /**
   * Create driver profile
   * POST /api/deliveries/drivers/profile
   */
  createDriverProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const driver = await deliveryService.createDriverProfile(userId, req.body);

    res.status(201).json({
      success: true,
      message: 'Driver profile created',
      data: driver,
    });
  });

  /**
   * Get driver's active delivery
   * GET /api/deliveries/drivers/active
   */
  getActiveDelivery = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const driver = await deliveryService.getDriverByUserId(userId);
    const delivery = await deliveryService.getActiveDelivery(driver.id);

    res.json({
      success: true,
      data: delivery,
    });
  });
}

export const deliveryController = new DeliveryController();
export default deliveryController;

