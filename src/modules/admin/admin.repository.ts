import { OrderStatus, Prisma, UserRole, VerificationStatus } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { ownerProductSelect } from '../products/product.repository.js';

const adminUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  phoneVerified: true,
  role: true,
  isActive: true,
  createdAt: true,
  farmerProfile: { select: { id: true, farmName: true, verificationStatus: true } },
} as const;

type UserFilters = { search?: string; role?: UserRole; isActive?: boolean };

const usersWhere = (data: UserFilters): Prisma.UserWhereInput => ({
  ...(data.role && { role: data.role }),
  ...(data.isActive !== undefined && { isActive: data.isActive }),
  ...(data.search && {
    OR: [
      { name: { contains: data.search, mode: 'insensitive' } },
      { email: { contains: data.search, mode: 'insensitive' } },
      { phone: { contains: data.search } },
    ],
  }),
});

export const findUsers = (data: UserFilters & { skip: number; take: number }) => {
  return prisma.user.findMany({
    where: usersWhere(data),
    orderBy: { createdAt: 'desc' },
    skip: data.skip,
    take: data.take,
    select: adminUserSelect,
  });
};

export const countUsers = (data: UserFilters) => prisma.user.count({ where: usersWhere(data) });

export const findUserDetail = (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...adminUserSelect,
      addresses: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, label: true, line1: true, line2: true, city: true, pincode: true },
      },
      _count: { select: { orders: true } },
    },
  });
};

// Suspending also ends every session, so nothing can be refreshed while suspended
export const setUserActive = (userId: string, isActive: boolean) => {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { isActive },
      select: adminUserSelect,
    });
    if (!isActive) {
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return user;
  });
};

type ProductFilters = {
  search?: string;
  farmId?: string;
  categoryId?: string;
  hidden?: boolean;
};

const productsWhere = (data: ProductFilters): Prisma.ProductWhereInput => ({
  deletedAt: null,
  ...(data.farmId && { farmId: data.farmId }),
  ...(data.categoryId && { categoryId: data.categoryId }),
  ...(data.hidden !== undefined && { hiddenAt: data.hidden ? { not: null } : null }),
  ...(data.search && { name: { contains: data.search, mode: 'insensitive' } }),
});

export const findProducts = (data: ProductFilters & { skip: number; take: number }) => {
  return prisma.product.findMany({
    where: productsWhere(data),
    orderBy: { createdAt: 'desc' },
    skip: data.skip,
    take: data.take,
    select: ownerProductSelect,
  });
};

export const countProducts = (data: ProductFilters) =>
  prisma.product.count({ where: productsWhere(data) });

export const setProductHidden = async (productId: string, hidden: boolean, reason?: string) => {
  const result = await prisma.product.updateMany({
    where: { id: productId, deletedAt: null },
    data: { hiddenAt: hidden ? new Date() : null, hiddenReason: hidden ? reason : null },
  });
  if (result.count !== 1) return null;

  return prisma.product.findUnique({ where: { id: productId }, select: ownerProductSelect });
};

export const loadStats = async () => {
  const [buyers, suspendedUsers, pendingFarmers, approvedFarmers, products, ordersByStatus] =
    await Promise.all([
      prisma.user.count({ where: { role: UserRole.USER } }),
      prisma.user.count({ where: { isActive: false } }),
      prisma.farmerProfile.count({ where: { verificationStatus: VerificationStatus.PENDING } }),
      prisma.farmerProfile.count({ where: { verificationStatus: VerificationStatus.APPROVED } }),
      prisma.product.count({ where: { deletedAt: null, hiddenAt: null, isActive: true } }),
      prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

  const orders = Object.fromEntries(
    Object.values(OrderStatus).map((status) => [
      status,
      ordersByStatus.find((row) => row.status === status)?._count._all ?? 0,
    ])
  );

  return { buyers, suspendedUsers, pendingFarmers, approvedFarmers, products, orders };
};
