import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireApprovedFarmer } from '../../middleware/require-approved-farmer.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  createProductController,
  deleteProductController,
  getProductController,
  getProductDeclarationController,
  listMyProductsController,
  listProductsController,
  updateProductController,
} from './product.controller.js';
import {
  createProductSchema,
  listProductsSchema,
  productIdSchema,
  updateProductSchema,
} from './product.schemas.js';

const productRouter = Router();

productRouter.use(authMiddleware);

// Fixed paths first so they are not captured by /:productId
productRouter.get('/declaration', getProductDeclarationController);
productRouter.get('/mine', requireApprovedFarmer(), listMyProductsController);

productRouter.get('/', validate(listProductsSchema), listProductsController);
productRouter.get('/:productId', validate(productIdSchema), getProductController);
productRouter.post(
  '/',
  requireApprovedFarmer(),
  validate(createProductSchema),
  createProductController
);
productRouter.patch(
  '/:productId',
  requireApprovedFarmer(),
  validate(updateProductSchema),
  updateProductController
);
productRouter.delete(
  '/:productId',
  requireApprovedFarmer(),
  validate(productIdSchema),
  deleteProductController
);

export default productRouter;
