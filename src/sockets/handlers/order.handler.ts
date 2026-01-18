import { Server, Socket } from 'socket.io';
import { logger } from '../../config/logger';
import { JwtPayload } from '../../middlewares/auth.middleware';

interface AuthenticatedSocket extends Socket {
  user?: JwtPayload;
}

export const orderHandler = (io: Server, socket: AuthenticatedSocket) => {
  const user = socket.user!;

  /**
   * Join order room to receive updates
   */
  socket.on('order:join', (orderId: string) => {
    socket.join(`order:${orderId}`);
    logger.debug(`User ${user.userId} joined order room: ${orderId}`);
  });

  /**
   * Leave order room
   */
  socket.on('order:leave', (orderId: string) => {
    socket.leave(`order:${orderId}`);
    logger.debug(`User ${user.userId} left order room: ${orderId}`);
  });

  /**
   * Join restaurant room (for staff to receive new orders)
   */
  socket.on('restaurant:join', (restaurantId: string) => {
    if (user.role === 'STAFF' || user.role === 'ADMIN') {
      socket.join(`restaurant:${restaurantId}`);
      logger.debug(`Staff ${user.userId} joined restaurant room: ${restaurantId}`);
    }
  });

  /**
   * Leave restaurant room
   */
  socket.on('restaurant:leave', (restaurantId: string) => {
    socket.leave(`restaurant:${restaurantId}`);
    logger.debug(`User ${user.userId} left restaurant room: ${restaurantId}`);
  });
};

export default orderHandler;

