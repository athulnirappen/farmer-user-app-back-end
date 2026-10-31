import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    // Every file shares one database, so they can't run at the same time
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      // Local Docker database from docker-compose.yml; CI overrides it
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgresql://farmer_user:farmer_password@localhost:5433/farmer_test?schema=public',
      JWT_SECRET: 'test-only-jwt-secret-at-least-32-characters',
      ADMIN_REGISTRATION_SECRET: 'test-only-admin-secret-at-least-32-characters',
      // 24 means no cut-off, so results don't depend on the time of day
      ORDER_CUTOFF_HOUR: '24',
      RATE_LIMIT_MAX: '100000',
      UPLOADS_DIR: 'node_modules/.tmp/test-uploads',
    },
  },
});
