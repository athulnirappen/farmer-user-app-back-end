import { Request, Response, NextFunction } from "express";
import {
  addToCart,
  clearCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from "./cart.service.js";

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

export const getCartController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => respond(() => getCart(req.user!.id), 200, res, next);

export const addToCartController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => respond(() => addToCart(req.user!.id, req.body), 200, res, next);

export const updateCartItemController = (
  req: Request<{ productId: string }>,
  res: Response,
  next: NextFunction,
) =>
  respond(
    () => updateCartItem(req.user!.id, req.params.productId, req.body),
    200,
    res,
    next,
  );

export const removeCartItemController = (
  req: Request<{ productId: string }>,
  res: Response,
  next: NextFunction,
) => respond(() => removeCartItem(req.user!.id, req.params.productId), 200, res, next);

export const clearCartController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => respond(() => clearCart(req.user!.id), 200, res, next);
