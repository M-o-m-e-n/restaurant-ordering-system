import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config';
import { logger } from '../config/logger';
import { JwtPayload } from '../middlewares/auth.middleware';
import redis from '../config/redis';
import { orderHandler } from './handlers/order.handler';
import { deliveryHandler } from './handlers/delivery.handler';

let io: Server | null = null;

interface AuthenticatedSocket extends Socket {
  user?: JwtPayload;
}

export const initializeSocket = (server: HTTPServer): Server => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const isBlacklisted = await redis.get(`blacklist:${token}`);
      if (isBlacklisted) {
        return next(new Error('Token has been revoked'));
      }

      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.user!;
    logger.info(`Socket connected: ${socket.id} (User: ${user.userId})`);

    // Join user-specific room
    socket.join(`user:${user.userId}`);

    // Join role-based rooms
    if (user.role === 'DRIVER') {
      socket.join(`driver:${user.userId}`);
    }

    // Register event handlers
    orderHandler(io!, socket);
    deliveryHandler(io!, socket);

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (Reason: ${reason})`);
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error: ${socket.id}`, error);
    });
  });

  logger.info('Socket.io initialized');
  return io;
};

export const getIO = (): Server | null => {
  return io;
};

export default { initializeSocket, getIO };
