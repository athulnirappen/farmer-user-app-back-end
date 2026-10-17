import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/app-error.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

type HttpError = Error & { status?: number; expose?: boolean; type?: string };

const toClientError = (err: Error): { statusCode: number; message: string } => {
  if (err instanceof AppError) {
    return { statusCode: err.statusCode, message: err.message };
  }

  // Request parsing errors from Express (malformed JSON, body too large) carry their own 4xx status
  const { status, expose, type } = err as HttpError;
  if (expose && typeof status === 'number' && status >= 400 && status < 500) {
    const message = type === 'entity.parse.failed' ? 'Malformed JSON in request body' : err.message;
    return { statusCode: status, message };
  }

  return { statusCode: 500, message: 'Internal Server Error' };
};

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { statusCode, message } = toClientError(err);

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
