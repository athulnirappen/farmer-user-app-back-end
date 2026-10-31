import { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors/app-error.js';
import { getPagination } from '../../shared/utils/pagination.js';
import { recordAdminAction } from '../admin/audit.repository.js';
import {
  countCategories,
  countProductsInCategory,
  createCategory,
  deleteCategory,
  findCategories,
  findCategoryById,
  findCategoryBySlug,
  updateCategory,
} from './category.repository.js';
import { CategoryInput, ListCategoriesQuery } from './category.schemas.js';

const isPrismaError = (error: unknown, code: string) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

// "  Fresh  Fruits " -> "fresh-fruits", so names differing only in case or spacing collide
export const toSlug = (name: string) => name.trim().toLowerCase().replace(/\s+/g, '-');

export const listCategories = async (query: ListCategoriesQuery) => {
  const { page, limit, skip } = getPagination(query.page, query.limit);
  const [items, total] = await Promise.all([
    findCategories({ search: query.search, skip, take: limit }),
    countCategories(query.search),
  ]);

  return { items, page, limit, total };
};

export const getCategory = async (categoryId: string) => {
  const category = await findCategoryById(categoryId);

  if (!category) {
    throw new AppError('Category not found', 404);
  }

  return category;
};

const auditCategory = (adminId: string, action: string, categoryId: string, name?: string) =>
  recordAdminAction({
    actorId: adminId,
    action,
    targetType: 'CATEGORY',
    targetId: categoryId,
    details: name ? { name } : undefined,
  });

export const findOrCreateCategory = async (
  user: { id: string; role: 'ADMIN' | 'USER' },
  input: CategoryInput
) => {
  const slug = toSlug(input.name);
  const existing = await findCategoryBySlug(slug);

  if (existing) {
    return { category: existing, created: false };
  }

  try {
    const category = await createCategory({ name: input.name, slug, createdById: user.id });
    if (user.role === 'ADMIN') {
      await auditCategory(user.id, 'CATEGORY_CREATED', category.id, category.name);
    }
    return { category, created: true };
  } catch (error) {
    if (isPrismaError(error, 'P2002')) {
      // Someone created the same category at the same moment
      const category = await findCategoryBySlug(slug);
      if (category) {
        return { category, created: false };
      }
      throw new AppError('A category with this name already exists', 409);
    }
    throw error;
  }
};

export const renameCategory = async (adminId: string, categoryId: string, input: CategoryInput) => {
  const slug = toSlug(input.name);
  const clash = await findCategoryBySlug(slug);

  if (clash && clash.id !== categoryId) {
    throw new AppError('A category with this name already exists', 409);
  }

  try {
    const category = await updateCategory(categoryId, { name: input.name, slug });
    await auditCategory(adminId, 'CATEGORY_RENAMED', categoryId, category.name);
    return category;
  } catch (error) {
    if (isPrismaError(error, 'P2025')) {
      throw new AppError('Category not found', 404);
    }
    if (isPrismaError(error, 'P2002')) {
      throw new AppError('A category with this name already exists', 409);
    }
    throw error;
  }
};

export const removeCategory = async (adminId: string, categoryId: string) => {
  const productCount = await countProductsInCategory(categoryId);

  if (productCount > 0) {
    throw new AppError(`Category is used by ${productCount} products`, 409);
  }

  try {
    await deleteCategory(categoryId);
    await auditCategory(adminId, 'CATEGORY_DELETED', categoryId);
    return { message: 'Category deleted' };
  } catch (error) {
    if (isPrismaError(error, 'P2025')) {
      throw new AppError('Category not found', 404);
    }
    if (isPrismaError(error, 'P2003')) {
      throw new AppError('Category is used by deleted products that past orders refer to', 409);
    }
    throw error;
  }
};
