import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { getMyProfileController, updateMyProfileController } from './profile.controller.js';
import { updateProfileSchema } from './profile.schemas.js';

const profileRouter = Router();

profileRouter.use(authMiddleware);

profileRouter.get('/', getMyProfileController);
profileRouter.patch('/', validate(updateProfileSchema), updateMyProfileController);

export default profileRouter;
