import { Request, Response, NextFunction } from 'express';
import { logoutSession, refreshSession } from './auth.session.service.js';

export const refreshSessionController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await refreshSession(req.body);
    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

export const logoutSessionController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await logoutSession(req.body);
    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};