import { Router, Request, Response } from 'express';
import authRouter from '../modules/auth/auth.routes.js';
import farmerRouter from '../modules/farmers/farmer.routes.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/farmers', farmerRouter);

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
