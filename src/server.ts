import http from 'http';
import app from './app';
import config from './config';
import { logger } from './config/logger';
import { initializeSocket } from './sockets';
import { initializeFirebase } from './config/firebase';
import { initializeTwilio } from './config/twilio';
import redis from './config/redis';
import prisma from './config/database';

const server = http.createServer(app);

// Initialize Socket.io
initializeSocket(server);

// Initialize external services
initializeFirebase();
initializeTwilio();

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Close database connection
      await prisma.$disconnect();
      logger.info('Database connection closed');

      // Close Redis connection
      await redis.quit();
      logger.info('Redis connection closed');

      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected');

    // Test Redis connection (optional in development)
    try {
      await redis.ping();
      logger.info('Redis connected');
    } catch (redisError) {
      logger.warn('Redis is not available. Continuing without Redis-dependent features.', redisError);
    }

    server.listen(config.port, () => {
      logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
      logger.info(`API available at http://localhost:${config.port}/api`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
