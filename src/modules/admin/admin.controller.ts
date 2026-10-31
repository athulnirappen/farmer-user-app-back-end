import { Request, Response, NextFunction } from "express";
import {
  getStats,
  getUser,
  listAuditLog,
  listProducts,
  listUsers,
  updateProductVisibility,
  updateUserStatus,
} from "./admin.service.js";
import {
  ListAuditLogQuery,
  ListProductsQuery,
  ListUsersQuery,
} from "./admin.schemas.js";

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

export const getStatsController = (req: Request, res: Response, next: NextFunction) =>
  respond(() => getStats(), res, next);

export const listUsersController = (req: Request, res: Response, next: NextFunction) =>
  respond(() => listUsers(req.query as unknown as ListUsersQuery), res, next);

export const getUserController = (
  req: Request<{ userId: string }>,
  res: Response,
  next: NextFunction,
) => respond(() => getUser(req.params.userId), res, next);

export const updateUserStatusController = (
  req: Request<{ userId: string }>,
  res: Response,
  next: NextFunction,
) => respond(() => updateUserStatus(req.user!.id, req.params.userId, req.body), res, next);

export const listProductsController = (req: Request, res: Response, next: NextFunction) =>
  respond(() => listProducts(req.query as unknown as ListProductsQuery), res, next);

export const updateProductVisibilityController = (
  req: Request<{ productId: string }>,
  res: Response,
  next: NextFunction,
) =>
  respond(() => updateProductVisibility(req.user!.id, req.params.productId, req.body), res, next);

export const listAuditLogController = (req: Request, res: Response, next: NextFunction) =>
  respond(() => listAuditLog(req.query as unknown as ListAuditLogQuery), res, next);
