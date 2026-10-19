import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireApprovedFarmer } from '../../middleware/require-approved-farmer.middleware.js';
import { requireRole } from '../../middleware/require-role.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  cancelOrderController,
  checkoutController,
  getOrderController,
  getOrderSlotsController,
  listAllOrdersController,
  listBuyerOrdersController,
  listFarmerOrdersController,
  updateOrderStatusController,
} from './order.controller.js';
import {
  adminOrdersSchema,
  buyerOrdersSchema,
  cancelOrderSchema,
  checkoutSchema,
  farmerOrdersSchema,
  orderIdSchema,
  updateOrderStatusSchema,
} from './order.schemas.js';

const orderRouter = Router();

orderRouter.use(authMiddleware);

// Fixed paths first so they are not captured by /:orderId
orderRouter.get('/slots', getOrderSlotsController);
orderRouter.get(
  '/farmer',
  requireApprovedFarmer(),
  validate(farmerOrdersSchema),
  listFarmerOrdersController
);
orderRouter.get('/admin', requireRole('ADMIN'), validate(adminOrdersSchema), listAllOrdersController);

orderRouter.post('/', requireRole('USER'), validate(checkoutSchema), checkoutController);
orderRouter.get('/', requireRole('USER'), validate(buyerOrdersSchema), listBuyerOrdersController);
orderRouter.get('/:orderId', validate(orderIdSchema), getOrderController);
orderRouter.post('/:orderId/cancel', validate(cancelOrderSchema), cancelOrderController);
orderRouter.patch('/:orderId/status', validate(updateOrderStatusSchema), updateOrderStatusController);

export default orderRouter;
