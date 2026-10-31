import { Request, Response, NextFunction } from "express";
import {
  addImage,
  addProduct,
  deleteProduct,
  editProduct,
  getProduct,
  getProductDeclaration,
  listMyProducts,
  listProducts,
  removeProductImage,
} from "./product.service.js";
import { ListProductsQuery, MyProductsQuery } from "./product.schemas.js";

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
) => respond(
    () => listMyProducts(req.farmerProfileId!, req.query as unknown as MyProductsQuery),
    200,
    res,
    next,
  );

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

export const addProductImageController = (
  req: Request<{ productId: string }>,
  res: Response,
  next: NextFunction,
) => respond(() => addImage(req.farmerProfileId!, req.params.productId, req.file), 201, res, next);

export const deleteProductImageController = (
  req: Request<{ productId: string; imageId: string }>,
  res: Response,
  next: NextFunction,
) =>
  respond(
    () => removeProductImage(req.farmerProfileId!, req.params.productId, req.params.imageId),
    200,
    res,
    next,
  );

export const deleteProductController = (
  req: Request<{ productId: string }>,
  res: Response,
  next: NextFunction,
) => respond(() => deleteProduct(req.farmerProfileId!, req.params.productId), 200, res, next);
