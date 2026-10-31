import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireApprovedFarmer } from '../../middleware/require-approved-farmer.middleware.js';
import { requireRole } from '../../middleware/require-role.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  applyToBecomeFarmerController,
  getMyFarmerApplicationController,
  listFarmerApplicationsController,
  listNearbyFarmsController,
  listPendingFarmerApplicationsController,
  reviewFarmerApplicationController,
  updateMyFarmLocationController,
} from './farmer.controller.js';
import {
  farmerApplicationSchema,
  farmerApplicationsSchema,
  nearbyFarmsSchema,
  reviewFarmerApplicationSchema,
  updateFarmLocationSchema,
} from './farmer.schemas.js';

const farmerRouter = Router();

farmerRouter.use(authMiddleware);
farmerRouter.get('/nearby', validate(nearbyFarmsSchema), listNearbyFarmsController);
farmerRouter.post(
  '/applications',
  requireRole('USER'),
  validate(farmerApplicationSchema),
  applyToBecomeFarmerController
);
farmerRouter.get('/applications/me', requireRole('USER'), getMyFarmerApplicationController);
farmerRouter.patch(
  '/me/location',
  requireApprovedFarmer(),
  validate(updateFarmLocationSchema),
  updateMyFarmLocationController
);
farmerRouter.get(
  '/admin/applications',
  requireRole('ADMIN'),
  validate(farmerApplicationsSchema),
  listFarmerApplicationsController
);
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