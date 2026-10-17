import { Prisma, VerificationStatus } from '@prisma/client';
import { prisma } from '../../prisma/client.js';

const productSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  stock: true,
  unit: true,
  isActive: true,
  category: { select: { id: true, name: true } },
  farmer: { select: { id: true, farmName: true, farmLocation: true } },
  declarationVersion: true,
  declarationAcceptedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

// What buyers can see: listed, not deleted, from a farmer who is still approved
const visibleWhere: Prisma.ProductWhereInput = {
  deletedAt: null,
  isActive: true,
  farmer: { verificationStatus: VerificationStatus.APPROVED },
};

const listFilter = (data: { search?: string; categoryId?: string }): Prisma.ProductWhereInput => ({
  ...visibleWhere,
  ...(data.categoryId && { categoryId: data.categoryId }),
  ...(data.search && { name: { contains: data.search, mode: 'insensitive' } }),
});

export const findVisibleProducts = (data: {
  search?: string;
  categoryId?: string;
  skip: number;
  take: number;
}) => {
  return prisma.product.findMany({
    where: listFilter(data),
    orderBy: { createdAt: 'desc' },
    skip: data.skip,
    take: data.take,
    select: productSelect,
  });
};

export const countVisibleProducts = (data: { search?: string; categoryId?: string }) => {
  return prisma.product.count({ where: listFilter(data) });
};

export const findVisibleProductById = (productId: string) => {
  return prisma.product.findFirst({
    where: { id: productId, ...visibleWhere },
    select: productSelect,
  });
};

export const findFarmerProducts = (farmId: string) => {
  return prisma.product.findMany({
    where: { farmId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: productSelect,
  });
};

export const findOwnedProductById = (productId: string, farmId: string) => {
  return prisma.product.findFirst({
    where: { id: productId, farmId, deletedAt: null },
    select: productSelect,
  });
};

export const createProduct = (data: Prisma.ProductUncheckedCreateInput) => {
  return prisma.product.create({
    data,
    select: productSelect,
  });
};

export const updateOwnedProduct = (
  productId: string,
  farmId: string,
  data: Prisma.ProductUncheckedUpdateManyInput
) => {
  return prisma.product.updateMany({
    where: { id: productId, farmId, deletedAt: null },
    data,
  });
};
