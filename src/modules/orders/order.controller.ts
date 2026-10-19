import { Request, Response, NextFunction } from "express";
import {
  cancelOrder,
  checkout,
  getOrder,
  getOrderSlots,
  listAllOrders,
  listBuyerOrders,
  listFarmerOrders,
  updateOrderStatus,
} from "./order.service.js";
import {
  AdminOrdersQuery,
  BuyerOrdersQuery,
  FarmerOrdersQuery,
} from "./order.schemas.js";

const respond = async (
  action: () => unknown,
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

export const getOrderSlotsController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => respond(() => getOrderSlots(), 200, res, next);

export const checkoutController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => respond(() => checkout(req.user!.id, req.body), 201, res, next);

export const listBuyerOrdersController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => respond(() => listBuyerOrders(req.user!.id, req.query as BuyerOrdersQuery), 200, res, next);

export const listFarmerOrdersController = (
  req: Request,
  res: Response,
  next: NextFunction,
) =>
  respond(
    () => listFarmerOrders(req.farmerProfileId!, req.query as FarmerOrdersQuery),
    200,
    res,
    next,
  );

export const listAllOrdersController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => respond(() => listAllOrders(req.query as AdminOrdersQuery), 200, res, next);

export const getOrderController = (
  req: Request<{ orderId: string }>,
  res: Response,
  next: NextFunction,
) => respond(() => getOrder(req.params.orderId, req.user!), 200, res, next);

export const cancelOrderController = (
  req: Request<{ orderId: string }>,
  res: Response,
  next: NextFunction,
) =>
  respond(
    () => cancelOrder(req.params.orderId, req.user!, req.body?.reason),
    200,
    res,
    next,
  );

export const updateOrderStatusController = (
  req: Request<{ orderId: string }>,
  res: Response,
  next: NextFunction,
) =>
  respond(
    () => updateOrderStatus(req.params.orderId, req.user!, req.body.status),
    200,
    res,
    next,
  );
