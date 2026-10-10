import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/app-error.js';
import { verifyToken } from '../shared/utils/jwt.js';

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authorization = req.header('authorization');
  const bearerToken = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];

  if (!bearerToken) {
    next(new AppError('Authentication required', 401));
    return;
  }

  try {
    const payload = verifyToken(bearerToken);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (error) {
    next(error);
  }
};
