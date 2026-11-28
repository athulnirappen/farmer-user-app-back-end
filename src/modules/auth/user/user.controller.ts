import { Request, Response, NextFunction } from 'express';
import {
  changePassword,
  loginBuyer,
  registerBuyer,
  requestBuyerRegistrationOtp,
  startUserAuth,
  verifyBuyerLoginOtp,
  verifyBuyerRegistrationOtp,
} from './user.service.js';

const respond = async (
  action: () => Promise<unknown>,
  statusCode: number,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await action();
    res.status(statusCode).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
};

export const startUserAuthController = (req: Request, res: Response, next: NextFunction) =>
  respond(() => startUserAuth(req.body), 200, res, next);

export const requestBuyerRegistrationOtpController = (
  req: Request,
  res: Response,
  next: NextFunction
) => respond(() => requestBuyerRegistrationOtp(req.body), 200, res, next);

export const verifyBuyerRegistrationOtpController = (
  req: Request,
  res: Response,
  next: NextFunction
) => respond(() => verifyBuyerRegistrationOtp(req.body), 201, res, next);

export const verifyBuyerLoginOtpController = (
  req: Request,
  res: Response,
  next: NextFunction
) => respond(() => verifyBuyerLoginOtp(req.body), 200, res, next);
export const registerBuyerController = (req: Request, res: Response, next: NextFunction) =>
  respond(() => registerBuyer(req.body), 201, res, next);

export const loginBuyerController = (req: Request, res: Response, next: NextFunction) =>
  respond(() => loginBuyer(req.body), 200, res, next);

export const changePasswordController = (req: Request, res: Response, next: NextFunction) =>
  respond(() => changePassword(req.user!.id, req.body), 200, res, next);
