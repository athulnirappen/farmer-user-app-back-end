import pino from 'pino';
import { env } from './env.js';

export const LOG_REDACTION = {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers["x-admin-registration-secret"]',
  ],
  remove: true,
};

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: LOG_REDACTION,
});
