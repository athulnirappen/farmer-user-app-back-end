import { AppError } from '../../shared/errors/app-error.js';
import {
  createAddress,
  deleteAddress,
  findAddress,
  findAddresses,
  setDefaultAddress,
  updateAddress,
} from './address.repository.js';
import { CreateAddressInput, UpdateAddressInput } from './address.schemas.js';

// Another user's address is reported as missing, so ids can't be probed
const notFound = () => new AppError('Address not found', 404);

export const listMyAddresses = (userId: string) => findAddresses(userId);

export const addMyAddress = (userId: string, { isDefault, ...data }: CreateAddressInput) =>
  createAddress(userId, data, isDefault === true);

export const editMyAddress = async (userId: string, addressId: string, input: UpdateAddressInput) => {
  const result = await updateAddress(userId, addressId, input);

  if (result.count !== 1) {
    throw notFound();
  }

  return findAddress(userId, addressId);
};

export const removeMyAddress = async (userId: string, addressId: string) => {
  if (!(await deleteAddress(userId, addressId))) {
    throw notFound();
  }

  return findAddresses(userId);
};

export const makeDefaultAddress = async (userId: string, addressId: string) => {
  if (!(await setDefaultAddress(userId, addressId))) {
    throw notFound();
  }

  return findAddresses(userId);
};
