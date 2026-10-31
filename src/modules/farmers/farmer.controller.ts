import { Request, Response, NextFunction } from "express";
import {
  applyToBecomeFarmer,
  getMyFarmerApplication,
  listFarmerApplications,
  listNearbyFarms,
  listPendingFarmerApplications,
  reviewFarmerApplication,
  updateMyFarmLocation,
} from "./farmer.service.js";
import { FarmerApplicationsQuery, NearbyFarmsQuery } from "./farmer.schemas.js";

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

export const updateMyFarmLocationController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => respond(() => updateMyFarmLocation(req.farmerProfileId!, req.body), 200, res, next);

export const listNearbyFarmsController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => respond(() => listNearbyFarms(req.query as unknown as NearbyFarmsQuery), 200, res, next);

export const listPendingFarmerApplicationsController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => respond(() => listPendingFarmerApplications(), 200, res, next);

export const listFarmerApplicationsController = (
  req: Request,
  res: Response,
  next: NextFunction,
) =>
  respond(
    () => listFarmerApplications(req.query as unknown as FarmerApplicationsQuery),
    200,
    res,
    next,
  );

export const reviewFarmerApplicationController = (
  req: Request<{ applicationId: string }>,
  res: Response,
  next: NextFunction,
) =>
  respond(
    () => reviewFarmerApplication(req.user!.id, req.params.applicationId, req.body),
    200,
    res,
    next,
  );
