import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/require-role.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  createFarmerController,
  getStatsController,
  getUserController,
  listAuditLogController,
  listProductsController,
  listUsersController,
  updateProductVisibilityController,
  updateUserStatusController,
} from './admin.controller.js';
import {
  createFarmerSchema,
  listAuditLogSchema,
  listProductsSchema,
  listUsersSchema,
  updateProductVisibilitySchema,
  updateUserStatusSchema,
  userIdSchema,
} from './admin.schemas.js';

const adminRouter = Router();

adminRouter.use(authMiddleware, requireRole('ADMIN'));

adminRouter.get('/stats', getStatsController);
adminRouter.get('/users', validate(listUsersSchema), listUsersController);
adminRouter.get('/users/:userId', validate(userIdSchema), getUserController);
adminRouter.post('/farmers', validate(createFarmerSchema), createFarmerController);
adminRouter.patch('/users/:userId/status', validate(updateUserStatusSchema), updateUserStatusController);
adminRouter.get('/products', validate(listProductsSchema), listProductsController);
adminRouter.patch(
  '/products/:productId/status',
  validate(updateProductVisibilitySchema),
  updateProductVisibilityController
);
adminRouter.get('/audit-log', validate(listAuditLogSchema), listAuditLogController);

export default adminRouter;
