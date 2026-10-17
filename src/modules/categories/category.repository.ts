import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client.js';

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} as const;

const searchFilter = (search?: string): Prisma.CategoryWhereInput =>
  search ? { name: { contains: search, mode: 'insensitive' } } : {};

export const findCategories = (data: { search?: string; skip: number; take: number }) => {
  return prisma.category.findMany({
    where: searchFilter(data.search),
    orderBy: { name: 'asc' },
    skip: data.skip,
    take: data.take,
    select: categorySelect,
  });
};

export const countCategories = (search?: string) => {
  return prisma.category.count({ where: searchFilter(search) });
};

export const findCategoryById = (categoryId: string) => {
  return prisma.category.findUnique({
    where: { id: categoryId },
    select: categorySelect,
  });
};

export const findCategoryBySlug = (slug: string) => {
  return prisma.category.findUnique({
    where: { slug },
    select: categorySelect,
  });
};

export const createCategory = (data: { name: string; slug: string; createdById: string }) => {
  return prisma.category.create({
    data,
    select: categorySelect,
  });
};

export const updateCategory = (categoryId: string, data: { name: string; slug: string }) => {
  return prisma.category.update({
    where: { id: categoryId },
    data,
    select: categorySelect,
  });
};

export const deleteCategory = (categoryId: string) => {
  return prisma.category.delete({
    where: { id: categoryId },
    select: { id: true },
  });
};

export const countProductsInCategory = (categoryId: string) => {
  return prisma.product.count({ where: { categoryId } });
};
