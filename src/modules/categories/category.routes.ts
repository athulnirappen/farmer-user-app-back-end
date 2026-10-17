import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireApprovedFarmer } from '../../middleware/require-approved-farmer.middleware.js';
import { requireRole } from '../../middleware/require-role.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  createCategoryController,
  deleteCategoryController,
  getCategoryController,
  listCategoriesController,
  updateCategoryController,
} from './category.controller.js';
import {
  createCategorySchema,
  deleteCategorySchema,
  getCategorySchema,
  listCategoriesSchema,
  updateCategorySchema,
} from './category.schemas.js';

const categoryRouter = Router();

categoryRouter.get('/', validate(listCategoriesSchema), listCategoriesController);
categoryRouter.get('/:categoryId', validate(getCategorySchema), getCategoryController);
categoryRouter.post(
  '/',
  authMiddleware,
  requireApprovedFarmer({ allowAdmin: true }),
  validate(createCategorySchema),
  createCategoryController
);
categoryRouter.patch(
  '/:categoryId',
  authMiddleware,
  requireRole('ADMIN'),
  validate(updateCategorySchema),
  updateCategoryController
);
categoryRouter.delete(
  '/:categoryId',
  authMiddleware,
  requireRole('ADMIN'),
  validate(deleteCategorySchema),
  deleteCategoryController
);

export default categoryRouter;
