import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';

export const MAX_ADDRESSES = 10;

const addressSelect = {
  id: true,
  label: true,
  line1: true,
  line2: true,
  city: true,
  pincode: true,
  latitude: true,
  longitude: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} as const;

type AddressData = Omit<Prisma.AddressUncheckedCreateInput, 'id' | 'userId' | 'isDefault'>;

// Serialises address changes for one user, so two requests can't both leave a default
// (or both create the first address)
const lockUser = (tx: Prisma.TransactionClient, userId: string) =>
  tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;

export const findAddresses = (userId: string) => {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    select: addressSelect,
  });
};

export const findAddress = (userId: string, addressId: string) => {
  return prisma.address.findFirst({
    where: { id: addressId, userId },
    select: addressSelect,
  });
};

export const findDefaultAddress = (userId: string) => {
  return prisma.address.findFirst({
    where: { userId, isDefault: true },
    select: addressSelect,
  });
};

export const createAddress = (userId: string, data: AddressData, makeDefault: boolean) => {
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);

    const count = await tx.address.count({ where: { userId } });
    if (count >= MAX_ADDRESSES) {
      throw new AppError(`You can save up to ${MAX_ADDRESSES} addresses`, 400);
    }

    // The first address is always the default
    const isDefault = makeDefault || count === 0;
    if (isDefault) {
      await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    }

    return tx.address.create({
      data: { ...data, userId, isDefault },
      select: addressSelect,
    });
  });
};

export const updateAddress = (userId: string, addressId: string, data: Prisma.AddressUpdateManyMutationInput) => {
  return prisma.address.updateMany({
    where: { id: addressId, userId },
    data,
  });
};

// Returns false when the address doesn't exist for this user
export const deleteAddress = (userId: string, addressId: string) => {
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);

    const address = await tx.address.findFirst({
      where: { id: addressId, userId },
      select: { isDefault: true },
    });
    if (!address) {
      return false;
    }

    await tx.address.delete({ where: { id: addressId } });

    if (address.isDefault) {
      const next = await tx.address.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (next) {
        await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }

    return true;
  });
};

// Returns false when the address doesn't exist for this user
export const setDefaultAddress = (userId: string, addressId: string) => {
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);

    const address = await tx.address.findFirst({ where: { id: addressId, userId }, select: { id: true } });
    if (!address) {
      return false;
    }

    await tx.address.updateMany({
      where: { userId, isDefault: true, id: { not: addressId } },
      data: { isDefault: false },
    });
    await tx.address.update({ where: { id: addressId }, data: { isDefault: true } });

    return true;
  });
};
