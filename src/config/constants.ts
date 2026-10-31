import { env } from './env.js';

export const API_PREFIX = '/api/v1';

// Only browsers enforce this, so it limits the admin web app; the mobile app sends no Origin
export const CORS_OPTIONS = {
  origin: env.CORS_ORIGINS,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
