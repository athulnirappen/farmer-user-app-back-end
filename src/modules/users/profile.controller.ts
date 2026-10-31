import { Request, Response, NextFunction } from "express";
import { getMyProfile, updateMyProfile } from "./profile.service.js";

const respond = async (
  action: () => Promise<unknown>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = await action();
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};

export const getMyProfileController = (req: Request, res: Response, next: NextFunction) =>
  respond(() => getMyProfile(req.user!.id), res, next);

export const updateMyProfileController = (req: Request, res: Response, next: NextFunction) =>
  respond(() => updateMyProfile(req.user!.id, req.body), res, next);
