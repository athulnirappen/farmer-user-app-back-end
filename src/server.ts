import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './prisma/client.js';
import { cleanupRefreshTokens } from './modules/auth/auth.session.service.js';
import { logger } from './config/logger.js';

let server: ReturnType<typeof app.listen>;
const refreshTokenCleanupInterval = 60 * 60 * 1000;
let cleanupTimer: NodeJS.Timeout | undefined;

const startServer = async () => {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');

    server = app.listen(env.PORT, () => {
      logger.info({ environment: env.NODE_ENV, port: env.PORT }, 'Server started');
    });
    cleanupTimer = setInterval(() => {
      void cleanupRefreshTokens().catch((error) => {
        logger.error({ err: error }, 'Refresh-token cleanup failed');
      });
    }, refreshTokenCleanupInterval);
    cleanupTimer.unref();
  } catch (err) {
    logger.fatal({ err }, 'Database connection failed');
    process.exit(1);
  }
};

void startServer();

const gracefulShutdown = async (signal: string) => {
  logger.info({ signal }, 'Starting graceful shutdown');

  if (cleanupTimer) clearInterval(cleanupTimer);

  server?.close(async () => {
    logger.info('HTTP server closed');

    try {
      await prisma.$disconnect();
      logger.info('Prisma database client disconnected');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error disconnecting database');
      process.exit(1);
    }
  });

  
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason: Error) => {
  logger.fatal({ err: reason }, 'Unhandled rejection; shutting down');
  server?.close(() => {
    process.exit(1);
  });
});

process.on('uncaughtException', (err: Error) => {
  logger.fatal({ err }, 'Uncaught exception; shutting down');
  process.exit(1);
});
