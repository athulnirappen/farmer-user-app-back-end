import { Prisma, VerificationStatus } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { distanceKmSql, NearbyPoint, withinRadiusSql } from '../../shared/utils/geo.js';

const productSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  stock: true,
  unit: true,
  isActive: true,
  category: { select: { id: true, name: true } },
  farmer: {
    select: { id: true, farmName: true, farmLocation: true, latitude: true, longitude: true },
  },
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

// Loads full rows for ids found by findNearbyVisibleProductIds
export const findVisibleProductsByIds = (ids: string[]) => {
  return prisma.product.findMany({
    where: { id: { in: ids }, ...visibleWhere },
    select: productSelect,
  });
};

// Raw SQL version of listFilter plus the distance check. Keep the visibility rules in step with visibleWhere.
const nearbyFilterSql = (data: NearbyPoint & { search?: string; categoryId?: string }) => {
  const conditions = [
    Prisma.sql`p."deletedAt" IS NULL`,
    Prisma.sql`p."isActive" = true`,
    Prisma.sql`fp."verificationStatus" = 'APPROVED'`,
    withinRadiusSql(data),
  ];
  if (data.categoryId) {
    conditions.push(Prisma.sql`p."categoryId" = ${data.categoryId}`);
  }
  if (data.search) {
    // Escape LIKE wildcards so a search for "50%" matches literally, like Prisma's contains
    const pattern = `%${data.search.replace(/[\\%_]/g, '\\$&')}%`;
    conditions.push(Prisma.sql`p."name" ILIKE ${pattern}`);
  }
  return Prisma.sql`
    FROM "Product" p
    JOIN "FarmerProfile" fp ON fp."id" = p."farmId"
    WHERE ${Prisma.join(conditions, ' AND ')}
  `;
};

export const findNearbyVisibleProductIds = (
  data: NearbyPoint & { search?: string; categoryId?: string; skip: number; take: number }
) => {
  return prisma.$queryRaw<{ id: string; distanceKm: number }[]>`
    SELECT p."id", ${distanceKmSql(data)} AS "distanceKm"
    ${nearbyFilterSql(data)}
    ORDER BY "distanceKm" ASC, p."createdAt" DESC
    LIMIT ${data.take} OFFSET ${data.skip}
  `;
};

export const countNearbyVisibleProducts = async (
  data: NearbyPoint & { search?: string; categoryId?: string }
) => {
  const [row] = await prisma.$queryRaw<{ total: number }[]>`
    SELECT COUNT(*)::int AS "total"
    ${nearbyFilterSql(data)}
  `;
  return row?.total ?? 0;
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
