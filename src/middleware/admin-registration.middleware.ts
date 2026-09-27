import { timingSafeEqual } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../shared/errors/app-error.js';

export const requireAdminRegistrationSecret = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const suppliedSecret = req.header('x-admin-registration-secret');
  const expectedSecret = Buffer.from(env.ADMIN_REGISTRATION_SECRET);
  const receivedSecret = Buffer.from(suppliedSecret ?? '');

  const valid =
    receivedSecret.length === expectedSecret.length &&
    timingSafeEqual(receivedSecret, expectedSecret);

  if (!valid) {
    next(new AppError('Admin registration is not authorized', 401));
    return;
  }

  next();
};