import { z } from 'zod';

const categoryName = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(2).max(60));

const categoryIdParams = z.object({
  categoryId: z.string().uuid(),
});

export const listCategoriesSchema = z.object({
  body: z.unknown(),
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().trim().min(1).max(60).optional(),
  }),
  params: z.object({}),
});

export const getCategorySchema = z.object({
  body: z.unknown(),
  query: z.object({}),
  params: categoryIdParams,
});

export const createCategorySchema = z.object({
  body: z.object({ name: categoryName }),
  query: z.object({}),
  params: z.object({}),
});

export const updateCategorySchema = z.object({
  body: z.object({ name: categoryName }),
  query: z.object({}),
  params: categoryIdParams,
});

export const deleteCategorySchema = getCategorySchema;

export type ListCategoriesQuery = z.infer<typeof listCategoriesSchema>['query'];
export type CategoryInput = z.infer<typeof createCategorySchema>['body'];
