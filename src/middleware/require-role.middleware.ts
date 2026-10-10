import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/app-error.js';

export const requireRole = (role: 'ADMIN' | 'USER') => (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    next(new AppError('Authentication required', 401));
    return;
  }

  if (req.user.role !== role) {
    next(new AppError('Insufficient permissions', 403));
    return;
  }

  next();
};