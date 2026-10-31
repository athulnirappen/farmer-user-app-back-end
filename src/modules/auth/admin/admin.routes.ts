import { Router } from 'express';
import { adminLoginRateLimit } from '../../../middleware/rate-limit.middleware.js';
import { validate } from '../../../middleware/validate.middleware.js';
import { requireAdminRegistrationSecret } from '../../../middleware/admin-registration.middleware.js';
import {
  loginAdminController,
  registerAdminController,
} from './admin.controller.js';
import { adminLoginSchema, adminRegisterSchema } from './admin.schemas.js';

const adminAuthRouter = Router();

adminAuthRouter.post(
  '/register',
  requireAdminRegistrationSecret,
  validate(adminRegisterSchema),
  registerAdminController
);
adminAuthRouter.post('/login', adminLoginRateLimit, validate(adminLoginSchema), loginAdminController);

export default adminAuthRouter;