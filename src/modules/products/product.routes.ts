import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireApprovedFarmer } from '../../middleware/require-approved-farmer.middleware.js';
import { uploadImage } from '../../middleware/upload.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  addProductImageController,
  createProductController,
  deleteProductController,
  deleteProductImageController,
  getProductController,
  getProductDeclarationController,
  listMyProductsController,
  listProductsController,
  updateProductController,
} from './product.controller.js';
import {
  createProductSchema,
  listProductsSchema,
  myProductsSchema,
  productIdSchema,
  productImageSchema,
  updateProductSchema,
} from './product.schemas.js';

const productRouter = Router();

// Fixed paths first so they are not captured by /:productId
productRouter.get('/declaration', authMiddleware, getProductDeclarationController);
productRouter.get(
  '/mine',
  authMiddleware,
  requireApprovedFarmer(),
  validate(myProductsSchema),
  listMyProductsController
);

// Browsing is public, so the app can show products before sign-in
productRouter.get('/', validate(listProductsSchema), listProductsController);
productRouter.get('/:productId', validate(productIdSchema), getProductController);

productRouter.post(
  '/',
  authMiddleware,
  requireApprovedFarmer(),
  validate(createProductSchema),
  createProductController
);
productRouter.patch(
  '/:productId',
  authMiddleware,
  requireApprovedFarmer(),
  validate(updateProductSchema),
  updateProductController
);
productRouter.delete(
  '/:productId',
  authMiddleware,
  requireApprovedFarmer(),
  validate(productIdSchema),
  deleteProductController
);
productRouter.post(
  '/:productId/images',
  authMiddleware,
  requireApprovedFarmer(),
  validate(productIdSchema),
  uploadImage,
  addProductImageController
);
productRouter.delete(
  '/:productId/images/:imageId',
  authMiddleware,
  requireApprovedFarmer(),
  validate(productImageSchema),
  deleteProductImageController
);

export default productRouter;
