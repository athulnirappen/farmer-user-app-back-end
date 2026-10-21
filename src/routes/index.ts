import { Router, Request, Response } from 'express';
import authRouter from '../modules/auth/auth.routes.js';
import farmerRouter from '../modules/farmers/farmer.routes.js';
import categoryRouter from '../modules/categories/category.routes.js';
import productRouter from '../modules/products/product.routes.js';
import orderRouter from '../modules/orders/order.routes.js';
import cartRouter from '../modules/cart/cart.routes.js';
import addressRouter from '../modules/users/address.routes.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/farmers', farmerRouter);
router.use('/categories', categoryRouter);
router.use('/products', productRouter);
router.use('/orders', orderRouter);
router.use('/cart', cartRouter);
router.use('/users/me/addresses', addressRouter);

/**
 * @route GET /health
 * @desc Basic health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
