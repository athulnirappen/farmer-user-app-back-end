import { Request, Response, NextFunction } from 'express';
import { isUserActive } from '../modules/auth/auth.repository.js';
import { AppError } from '../shared/errors/app-error.js';
import { verifyToken } from '../shared/utils/jwt.js';

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authorization = req.header('authorization');
  const bearerToken = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];

  if (!bearerToken) {
    next(new AppError('Authentication required', 401));
    return;
  }

  try {
    const payload = verifyToken(bearerToken);

    // Checked on every request so a suspension applies now, not when the token expires
    if (!(await isUserActive(payload.sub))) {
      next(new AppError('This account is not active', 401));
      return;
    }

    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (error) {
    next(error);
  }
};
