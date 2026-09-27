import { Router } from 'express';
import adminAuthRouter from './admin/admin.routes.js';
import userAuthRouter from './user/user.routes.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
	logoutSessionController,
	refreshSessionController,
} from './auth.session.controller.js';
import { refreshTokenSchema } from './auth.session.schemas.js';

const authRouter = Router();

authRouter.use('/admin', adminAuthRouter);
authRouter.use('/user', userAuthRouter);
authRouter.post('/refresh', validate(refreshTokenSchema), refreshSessionController);
authRouter.post('/logout', validate(refreshTokenSchema), logoutSessionController);

export default authRouter;