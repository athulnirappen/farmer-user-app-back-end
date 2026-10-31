import { Prisma, VerificationStatus } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { distanceKmSql, NearbyPoint, withinRadiusSql } from '../../shared/utils/geo.js';

export const productSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  stock: true,
  unit: true,
  isActive: true,
  images: { orderBy: { createdAt: 'asc' }, select: { id: true, url: true } },
  category: { select: { id: true, name: true } },
  farmer: {
    select: { id: true, farmName: true, farmLocation: true, latitude: true, longitude: true },
  },
  declarationVersion: true,
  declarationAcceptedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

// What the farmer and admins see: buyers aren't told why something was hidden
export const ownerProductSelect = {
  ...productSelect,
  hiddenAt: true,
  hiddenReason: true,
} as const;

// What buyers can see: listed, not deleted or hidden, from an approved farmer whose account is active
const visibleWhere: Prisma.ProductWhereInput = {
  deletedAt: null,
  hiddenAt: null,
  isActive: true,
  farmer: { verificationStatus: VerificationStatus.APPROVED, user: { isActive: true } },
};

type ProductFilter = { search?: string; categoryId?: string; farmId?: string };

const listFilter = (data: ProductFilter): Prisma.ProductWhereInput => ({
  ...visibleWhere,
  ...(data.categoryId && { categoryId: data.categoryId }),
  ...(data.farmId && { farmId: data.farmId }),
  ...(data.search && { name: { contains: data.search, mode: 'insensitive' } }),
});

export const findVisibleProducts = (data: ProductFilter & { skip: number; take: number }) => {
  return prisma.product.findMany({
    where: listFilter(data),
    orderBy: { createdAt: 'desc' },
    skip: data.skip,
    take: data.take,
    select: productSelect,
  });
};

export const countVisibleProducts = (data: ProductFilter) => {
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
const nearbyFilterSql = (data: NearbyPoint & ProductFilter) => {
  const conditions = [
    Prisma.sql`p."deletedAt" IS NULL`,
    Prisma.sql`p."hiddenAt" IS NULL`,
    Prisma.sql`p."isActive" = true`,
    Prisma.sql`fp."verificationStatus" = 'APPROVED'`,
    Prisma.sql`u."isActive" = true`,
    withinRadiusSql(data),
  ];
  if (data.categoryId) {
    conditions.push(Prisma.sql`p."categoryId" = ${data.categoryId}`);
  }
  if (data.farmId) {
    conditions.push(Prisma.sql`p."farmId" = ${data.farmId}`);
  }
  if (data.search) {
    // Escape LIKE wildcards so a search for "50%" matches literally, like Prisma's contains
    const pattern = `%${data.search.replace(/[\\%_]/g, '\\$&')}%`;
    conditions.push(Prisma.sql`p."name" ILIKE ${pattern}`);
  }
  return Prisma.sql`
    FROM "Product" p
    JOIN "FarmerProfile" fp ON fp."id" = p."farmId"
    JOIN "User" u ON u."id" = fp."userId"
    WHERE ${Prisma.join(conditions, ' AND ')}
  `;
};

export const findNearbyVisibleProductIds = (
  data: NearbyPoint & ProductFilter & { skip: number; take: number }
) => {
  return prisma.$queryRaw<{ id: string; distanceKm: number }[]>`
    SELECT p."id", ${distanceKmSql(data)} AS "distanceKm"
    ${nearbyFilterSql(data)}
    ORDER BY "distanceKm" ASC, p."createdAt" DESC
    LIMIT ${data.take} OFFSET ${data.skip}
  `;
};

export const countNearbyVisibleProducts = async (data: NearbyPoint & ProductFilter) => {
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

export const findFarmerProducts = (data: { farmId: string; skip: number; take: number }) => {
  return prisma.product.findMany({
    where: { farmId: data.farmId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    skip: data.skip,
    take: data.take,
    select: ownerProductSelect,
  });
};

export const countFarmerProducts = (farmId: string) =>
  prisma.product.count({ where: { farmId, deletedAt: null } });

export const countProductImages = (productId: string) =>
  prisma.productImage.count({ where: { productId } });

export const addProductImage = (data: { productId: string; key: string; url: string }) => {
  return prisma.productImage.create({ data, select: { id: true, url: true } });
};

export const findProductImage = (imageId: string, productId: string) => {
  return prisma.productImage.findFirst({ where: { id: imageId, productId } });
};

export const deleteProductImage = (imageId: string) => {
  return prisma.productImage.delete({ where: { id: imageId } });
};

export const findOwnedProductById = (productId: string, farmId: string) => {
  return prisma.product.findFirst({
    where: { id: productId, farmId, deletedAt: null },
    select: ownerProductSelect,
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
