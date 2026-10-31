import { AppError } from '../../shared/errors/app-error.js';
import { getPagination } from '../../shared/utils/pagination.js';
import {
  countProducts,
  countUsers,
  findProducts,
  findUserDetail,
  findUsers,
  loadStats,
  setProductHidden,
  setUserActive,
} from './admin.repository.js';
import {
  ListAuditLogQuery,
  ListProductsQuery,
  ListUsersQuery,
  UpdateProductVisibilityInput,
  UpdateUserStatusInput,
} from './admin.schemas.js';
import { countAuditEntries, findAuditEntries, recordAdminAction } from './audit.repository.js';

export const getStats = () => loadStats();

export const listUsers = async ({ page: queryPage, limit: queryLimit, ...filters }: ListUsersQuery) => {
  const { page, limit, skip } = getPagination(queryPage, queryLimit);
  const [items, total] = await Promise.all([
    findUsers({ ...filters, skip, take: limit }),
    countUsers(filters),
  ]);

  return { items, page, limit, total };
};

export const getUser = async (userId: string) => {
  const user = await findUserDetail(userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return user;
};

export const updateUserStatus = async (
  adminId: string,
  userId: string,
  { isActive, reason }: UpdateUserStatusInput
) => {
  // Stops the last admin locking everyone out
  if (adminId === userId) {
    throw new AppError("You can't change your own account status", 400);
  }

  await getUser(userId);
  const user = await setUserActive(userId, isActive);

  await recordAdminAction({
    actorId: adminId,
    action: isActive ? 'USER_REACTIVATED' : 'USER_SUSPENDED',
    targetType: 'USER',
    targetId: userId,
    details: reason ? { reason } : undefined,
  });

  return user;
};

export const listProducts = async ({
  page: queryPage,
  limit: queryLimit,
  ...filters
}: ListProductsQuery) => {
  const { page, limit, skip } = getPagination(queryPage, queryLimit);
  const [items, total] = await Promise.all([
    findProducts({ ...filters, skip, take: limit }),
    countProducts(filters),
  ]);

  return { items, page, limit, total };
};

export const updateProductVisibility = async (
  adminId: string,
  productId: string,
  { hidden, reason }: UpdateProductVisibilityInput
) => {
  const product = await setProductHidden(productId, hidden, reason);

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  await recordAdminAction({
    actorId: adminId,
    action: hidden ? 'PRODUCT_HIDDEN' : 'PRODUCT_RESTORED',
    targetType: 'PRODUCT',
    targetId: productId,
    details: reason ? { reason } : undefined,
  });

  return product;
};

export const listAuditLog = async ({
  page: queryPage,
  limit: queryLimit,
  ...filters
}: ListAuditLogQuery) => {
  const { page, limit, skip } = getPagination(queryPage, queryLimit);
  const [items, total] = await Promise.all([
    findAuditEntries({ ...filters, skip, take: limit }),
    countAuditEntries(filters),
  ]);

  return { items, page, limit, total };
};
