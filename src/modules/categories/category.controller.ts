import { Request, Response, NextFunction } from "express";
import {
  findOrCreateCategory,
  getCategory,
  listCategories,
  removeCategory,
  renameCategory,
} from "./category.service.js";
import { ListCategoriesQuery } from "./category.schemas.js";

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

export const listCategoriesController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => respond(() => listCategories(req.query as ListCategoriesQuery), 200, res, next);

export const getCategoryController = (
  req: Request<{ categoryId: string }>,
  res: Response,
  next: NextFunction,
) => respond(() => getCategory(req.params.categoryId), 200, res, next);

export const createCategoryController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await findOrCreateCategory(req.user!.id, req.body);
    res.status(result.created ? 201 : 200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
};

export const updateCategoryController = (
  req: Request<{ categoryId: string }>,
  res: Response,
  next: NextFunction,
) => respond(() => renameCategory(req.params.categoryId, req.body), 200, res, next);

export const deleteCategoryController = (
  req: Request<{ categoryId: string }>,
  res: Response,
  next: NextFunction,
) => respond(() => removeCategory(req.params.categoryId), 200, res, next);
