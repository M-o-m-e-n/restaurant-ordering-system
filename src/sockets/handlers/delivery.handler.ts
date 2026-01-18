import { Server, Socket } from 'socket.io';
import { logger } from '../../config/logger';
import { JwtPayload } from '../../middlewares/auth.middleware';
import { deliveryService } from '../../services/delivery.service';

interface AuthenticatedSocket extends Socket {
  user?: JwtPayload;
}

export const deliveryHandler = (io: Server, socket: AuthenticatedSocket) => {
  const user = socket.user!;

  /**
   * Driver sends location update
   */
  socket.on('delivery:location-update', async (data: {
    latitude: number;
    longitude: number;
  }) => {
    if (user.role !== 'DRIVER') {
      return socket.emit('error', { message: 'Unauthorized' });
    }

    try {
      const driver = await deliveryService.getDriverByUserId(user.userId);

      // Update driver location in database
      await deliveryService.updateDriverLocation(driver.id, data.latitude, data.longitude);

      // Get active delivery and broadcast location to delivery room
      const activeDelivery = await deliveryService.getActiveDelivery(driver.id);
      if (activeDelivery) {
        io.to(`delivery:${activeDelivery.id}`).emit('delivery:location-update', {
          deliveryId: activeDelivery.id,
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: new Date().toISOString(),
        });
      }

      logger.debug(`Driver ${driver.id} location updated: ${data.latitude}, ${data.longitude}`);
    } catch (error: any) {
      logger.error('Location update error:', error);
      socket.emit('error', { message: error.message });
    }
  });

  /**
   * Track delivery (customer joins delivery tracking room)
   */
  socket.on('delivery:track', (deliveryId: string) => {
    socket.join(`delivery:${deliveryId}`);
    logger.debug(`User ${user.userId} started tracking delivery: ${deliveryId}`);
  });

  /**
   * Stop tracking delivery
   */
  socket.on('delivery:untrack', (deliveryId: string) => {
    socket.leave(`delivery:${deliveryId}`);
    logger.debug(`User ${user.userId} stopped tracking delivery: ${deliveryId}`);
  });

  /**
   * Driver goes online/offline
   */
  socket.on('driver:status', async (data: { isAvailable: boolean }) => {
    if (user.role !== 'DRIVER') {
      return socket.emit('error', { message: 'Unauthorized' });
    }

    try {
      const driver = await deliveryService.getDriverByUserId(user.userId);
      await deliveryService.updateDriverAvailability(driver.id, data.isAvailable);

      socket.emit('driver:status-updated', { isAvailable: data.isAvailable });
      logger.debug(`Driver ${driver.id} status: ${data.isAvailable ? 'online' : 'offline'}`);
    } catch (error: any) {
      logger.error('Driver status update error:', error);
      socket.emit('error', { message: error.message });
    }
  });
};

export default deliveryHandler;
