import { Request, Response, NextFunction } from "express";
import {
  addMyAddress,
  editMyAddress,
  listMyAddresses,
  makeDefaultAddress,
  removeMyAddress,
} from "./address.service.js";

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

export const listMyAddressesController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => respond(() => listMyAddresses(req.user!.id), 200, res, next);

export const addMyAddressController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => respond(() => addMyAddress(req.user!.id, req.body), 201, res, next);

export const editMyAddressController = (
  req: Request<{ addressId: string }>,
  res: Response,
  next: NextFunction,
) => respond(() => editMyAddress(req.user!.id, req.params.addressId, req.body), 200, res, next);

export const removeMyAddressController = (
  req: Request<{ addressId: string }>,
  res: Response,
  next: NextFunction,
) => respond(() => removeMyAddress(req.user!.id, req.params.addressId), 200, res, next);

export const makeDefaultAddressController = (
  req: Request<{ addressId: string }>,
  res: Response,
  next: NextFunction,
) => respond(() => makeDefaultAddress(req.user!.id, req.params.addressId), 200, res, next);
