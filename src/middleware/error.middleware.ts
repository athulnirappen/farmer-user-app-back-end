import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/app-error.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err instanceof AppError ? err.message : 'Internal Server Error';

  // Log error stack in development/test, or if it is a non-operational 500 error
  if (env.NODE_ENV !== 'production' || !(err instanceof AppError)) {
    logger.error({ err, method: req.method, url: req.originalUrl }, 'Request failed');
  }

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message,
    ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};
