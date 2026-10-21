import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/require-role.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  addMyAddressController,
  editMyAddressController,
  listMyAddressesController,
  makeDefaultAddressController,
  removeMyAddressController,
} from './address.controller.js';
import {
  addressIdSchema,
  createAddressSchema,
  updateAddressSchema,
} from './address.schemas.js';

const addressRouter = Router();

// Any normal user, farmers included: everyone can buy
addressRouter.use(authMiddleware, requireRole('USER'));

addressRouter.get('/', listMyAddressesController);
addressRouter.post('/', validate(createAddressSchema), addMyAddressController);
addressRouter.patch('/:addressId', validate(updateAddressSchema), editMyAddressController);
addressRouter.delete('/:addressId', validate(addressIdSchema), removeMyAddressController);
addressRouter.post('/:addressId/default', validate(addressIdSchema), makeDefaultAddressController);

export default addressRouter;
