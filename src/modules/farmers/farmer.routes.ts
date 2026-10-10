import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/require-role.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  applyToBecomeFarmerController,
  getMyFarmerApplicationController,
  listPendingFarmerApplicationsController,
  reviewFarmerApplicationController,
} from './farmer.controller.js';
import {
  farmerApplicationSchema,
  reviewFarmerApplicationSchema,
} from './farmer.schemas.js';

const farmerRouter = Router();

farmerRouter.use(authMiddleware);
farmerRouter.post(
  '/applications',
  requireRole('USER'),
  validate(farmerApplicationSchema),
  applyToBecomeFarmerController
);
farmerRouter.get('/applications/me', requireRole('USER'), getMyFarmerApplicationController);
farmerRouter.get(
  '/admin/applications/pending',
  requireRole('ADMIN'),
  listPendingFarmerApplicationsController
);
farmerRouter.patch(
  '/admin/applications/:applicationId',
  requireRole('ADMIN'),
  validate(reviewFarmerApplicationSchema),
  reviewFarmerApplicationController
);

export default farmerRouter;