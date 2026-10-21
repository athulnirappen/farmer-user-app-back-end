import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/require-role.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  addToCartController,
  clearCartController,
  getCartController,
  removeCartItemController,
  updateCartItemController,
} from './cart.controller.js';
import {
  addCartItemSchema,
  cartItemIdSchema,
  updateCartItemSchema,
} from './cart.schemas.js';

const cartRouter = Router();

// Only buyers have a cart; checkout from it is POST /orders/from-cart
cartRouter.use(authMiddleware, requireRole('USER'));

cartRouter.get('/', getCartController);
cartRouter.delete('/', clearCartController);
cartRouter.post('/items', validate(addCartItemSchema), addToCartController);
cartRouter.patch('/items/:productId', validate(updateCartItemSchema), updateCartItemController);
cartRouter.delete('/items/:productId', validate(cartItemIdSchema), removeCartItemController);

export default cartRouter;
