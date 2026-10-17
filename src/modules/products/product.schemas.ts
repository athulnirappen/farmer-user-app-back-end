import { z } from 'zod';

const productIdParams = z.object({
  productId: z.string().uuid(),
});

const declarationFields = {
  // Checked in the service so a missing or false value gets a clear message
  acceptDeclaration: z.boolean().optional(),
  declarationVersion: z.string().trim().max(50).optional(),
};

const productFields = {
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  price: z.number().positive().max(99_999_999.99),
  stock: z.number().int().min(0),
  unit: z.string().trim().min(1).max(20),
  categoryId: z.string().uuid(),
  isActive: z.boolean().optional(),
};

export const listProductsSchema = z.object({
  body: z.unknown(),
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().trim().min(1).max(120).optional(),
    categoryId: z.string().uuid().optional(),
  }),
  params: z.object({}),
});

export const productIdSchema = z.object({
  body: z.unknown(),
  query: z.object({}),
  params: productIdParams,
});

export const createProductSchema = z.object({
  body: z.object({ ...productFields, ...declarationFields }),
  query: z.object({}),
  params: z.object({}),
});

export const updateProductSchema = z.object({
  body: z
    .object({
      name: productFields.name.optional(),
      description: productFields.description,
      price: productFields.price.optional(),
      stock: productFields.stock.optional(),
      unit: productFields.unit.optional(),
      categoryId: productFields.categoryId.optional(),
      isActive: productFields.isActive,
      ...declarationFields,
    })
    .refine(
      ({ acceptDeclaration, declarationVersion, ...fields }) =>
        Object.values(fields).some((value) => value !== undefined),
      'Provide at least one field to update'
    ),
  query: z.object({}),
  params: productIdParams,
});

export type ListProductsQuery = z.infer<typeof listProductsSchema>['query'];
export type CreateProductInput = z.infer<typeof createProductSchema>['body'];
export type UpdateProductInput = z.infer<typeof updateProductSchema>['body'];
