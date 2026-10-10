import { Request, Response, NextFunction } from "express";
import {
  applyToBecomeFarmer,
  getMyFarmerApplication,
  listPendingFarmerApplications,
  reviewFarmerApplication,
} from "./farmer.service.js";

const respond = async (
  action: () => Promise<unknown>,
  statusCode: number,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = await action();
    res.status(statusCode).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};

export const applyToBecomeFarmerController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => respond(() => applyToBecomeFarmer(req.user!.id, req.body), 201, res, next);

export const getMyFarmerApplicationController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => respond(() => getMyFarmerApplication(req.user!.id), 200, res, next);

export const listPendingFarmerApplicationsController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => respond(() => listPendingFarmerApplications(), 200, res, next);

export const reviewFarmerApplicationController = (
  req: Request<{ applicationId: string }>,
  res: Response,
  next: NextFunction,
) =>
  respond(
    () => reviewFarmerApplication(req.params.applicationId, req.body.status),
    200,
    res,
    next,
  );
