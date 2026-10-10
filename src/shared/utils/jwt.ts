import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';

export type AccessTokenPayload = JwtPayload & {
  sub: string;
  role: 'ADMIN' | 'USER';
};

export const generateToken = (payload: Record<string, unknown>): string => {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_SECRET, options);
};

export const verifyToken = (token: string): AccessTokenPayload => {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);

    if (
      typeof payload === 'string' ||
      typeof payload.sub !== 'string' ||
      payload.sub.length === 0 ||
      (payload.role !== 'ADMIN' && payload.role !== 'USER')
    ) {
      throw new AppError('Invalid access token', 401);
    }

    return payload as AccessTokenPayload;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Invalid or expired access token', 401);
  }
};
