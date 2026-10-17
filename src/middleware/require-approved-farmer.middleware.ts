import { Request, Response, NextFunction } from 'express';
import { VerificationStatus } from '@prisma/client';
import { AppError } from '../shared/errors/app-error.js';
import { findFarmerApplicationByUserId } from '../modules/farmers/farmer.repository.js';

export const requireApprovedFarmer = (options: { allowAdmin?: boolean } = {}) => async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    next(new AppError('Authentication required', 401));
    return;
  }

  if (req.user.role === 'ADMIN') {
    next(options.allowAdmin ? undefined : new AppError('Insufficient permissions', 403));
    return;
  }

  try {
    const farmerProfile = await findFarmerApplicationByUserId(req.user.id);
    if (farmerProfile?.verificationStatus !== VerificationStatus.APPROVED) {
      next(new AppError('Only approved farmers can do this', 403));
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};
