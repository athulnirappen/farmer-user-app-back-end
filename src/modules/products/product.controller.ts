import { Request, Response, NextFunction } from "express";
import {
  addProduct,
  deleteProduct,
  editProduct,
  getProduct,
  getProductDeclaration,
  listMyProducts,
  listProducts,
} from "./product.service.js";
import { ListProductsQuery } from "./product.schemas.js";

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

export const getProductDeclarationController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => respond(() => getProductDeclaration(), 200, res, next);

export const listProductsController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => respond(() => listProducts(req.query as ListProductsQuery), 200, res, next);

export const getProductController = (
  req: Request<{ productId: string }>,
  res: Response,
  next: NextFunction,
) => respond(() => getProduct(req.params.productId), 200, res, next);

export const listMyProductsController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => respond(() => listMyProducts(req.farmerProfileId!), 200, res, next);

export const createProductController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => respond(() => addProduct(req.farmerProfileId!, req.body), 201, res, next);

export const updateProductController = (
  req: Request<{ productId: string }>,
  res: Response,
  next: NextFunction,
) =>
  respond(
    () => editProduct(req.farmerProfileId!, req.params.productId, req.body),
    200,
    res,
    next,
  );

export const deleteProductController = (
  req: Request<{ productId: string }>,
  res: Response,
  next: NextFunction,
) => respond(() => deleteProduct(req.farmerProfileId!, req.params.productId), 200, res, next);
