import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './prisma/client.js';
import { cleanupRefreshTokens } from './modules/auth/auth.session.service.js';

let server: ReturnType<typeof app.listen>;
const refreshTokenCleanupInterval = 60 * 60 * 1000;
let cleanupTimer: NodeJS.Timeout | undefined;

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log('Database connected successfully.');

    server = app.listen(env.PORT, () => {
      console.log(`🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    });
    cleanupTimer = setInterval(() => {
      void cleanupRefreshTokens().catch((error) => {
        console.error('Refresh-token cleanup failed:', error);
      });
    }, refreshTokenCleanupInterval);
    cleanupTimer.unref();
  } catch (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
  }
};

void startServer();

const gracefulShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  if (cleanupTimer) clearInterval(cleanupTimer);

  server?.close(async () => {
    console.log('HTTP server closed.');

    try {
      await prisma.$disconnect();
      console.log('Prisma database client disconnected.');
      process.exit(0);
    } catch (err) {
      console.error('Error disconnecting database:', err);
      process.exit(1);
    }
  });

  
  setTimeout(() => {
    console.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason: Error) => {
  console.error('Unhandled Rejection! Shutting down...');
  console.error(reason.name, reason.message);
  server?.close(() => {
    process.exit(1);
  });
});

process.on('uncaughtException', (err: Error) => {
  console.error('Uncaught Exception! Shutting down...:', err);
  process.exit(1);
});
