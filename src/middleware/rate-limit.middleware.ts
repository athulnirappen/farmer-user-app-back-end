import { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { API_PREFIX } from '../config/constants.js';
import { env } from '../config/env.js';
import { verifyToken } from '../shared/utils/jwt.js';

const tooManyRequests = (message: string) => ({ status: 'error', statusCode: 429, message });

const clientIp = (req: Request) => ipKeyGenerator(req.ip ?? '');

// Logged-in people get their own allowance, so users behind one carrier IP don't share a limit.
// The token is verified first; otherwise random tokens would each get a fresh allowance.
const userOrIpKey = (req: Request) => {
  const token = req.header('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return clientIp(req);

  try {
    return `user:${verifyToken(token).sub}`;
  } catch {
    return clientIp(req);
  }
};

export const rateLimitMiddleware = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  keyGenerator: userOrIpKey,
  skip: (req) => req.path === `${API_PREFIX}/health`,
  message: tooManyRequests('Too many requests, please try again later.'),
  standardHeaders: true,
  legacyHeaders: false,
});

export const adminLoginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: tooManyRequests('Too many login attempts; try again later.'),
  standardHeaders: true,
  legacyHeaders: false,
});

// Higher than login: each signed-in device refreshes about every 15 minutes, and many can share an IP
export const refreshRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: tooManyRequests('Too many requests, please try again later.'),
  standardHeaders: true,
  legacyHeaders: false,
});
