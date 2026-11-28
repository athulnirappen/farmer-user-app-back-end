import { z } from 'zod';

const page = z.coerce.number().int().min(1).optional();
const limit = z.coerce.number().int().min(1).max(100).optional();
const search = z.string().trim().min(1).max(120).optional();
const booleanQuery = z.enum(['true', 'false']).transform((value) => value === 'true').optional();
const reason = z.string().trim().min(1).max(300);

export const listUsersSchema = z.object({
  body: z.unknown(),
  query: z.object({
    page,
    limit,
    search,
    role: z.enum(['USER', 'ADMIN']).optional(),
    isActive: booleanQuery,
  }),
  params: z.object({}),
});

export const userIdSchema = z.object({
  body: z.unknown(),
  query: z.object({}),
  params: z.object({ userId: z.string().uuid() }),
});

export const updateUserStatusSchema = z.object({
  body: z
    .object({ isActive: z.boolean(), reason: reason.optional() })
    .refine((body) => body.isActive || body.reason !== undefined, {
      message: 'A reason is required to suspend a user',
      path: ['reason'],
    }),
  query: z.object({}),
  params: z.object({ userId: z.string().uuid() }),
});

export const listProductsSchema = z.object({
  body: z.unknown(),
  query: z.object({
    page,
    limit,
    search,
    farmId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    hidden: booleanQuery,
  }),
  params: z.object({}),
});

export const updateProductVisibilitySchema = z.object({
  body: z
    .object({ hidden: z.boolean(), reason: reason.optional() })
    .refine((body) => !body.hidden || body.reason !== undefined, {
      message: 'A reason is required to hide a product',
      path: ['reason'],
    }),
  query: z.object({}),
  params: z.object({ productId: z.string().uuid() }),
});

export const listAuditLogSchema = z.object({
  body: z.unknown(),
  query: z.object({
    page,
    limit,
    actorId: z.string().uuid().optional(),
    targetType: z.string().trim().min(1).max(30).optional(),
    targetId: z.string().uuid().optional(),
  }),
  params: z.object({}),
});

export type ListUsersQuery = z.infer<typeof listUsersSchema>['query'];
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>['body'];
export type ListProductsQuery = z.infer<typeof listProductsSchema>['query'];
export type UpdateProductVisibilityInput = z.infer<typeof updateProductVisibilitySchema>['body'];
export type ListAuditLogQuery = z.infer<typeof listAuditLogSchema>['query'];

// An admin sets up a farmer who won't do it themselves; the farm is approved straight away
export const createFarmerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email(),
    phone: z.string().trim().regex(/^\+[1-9]\d{7,14}$/, 'Phone must be in E.164 format'),
    temporaryPassword: z.string().min(8).max(72),
    farmName: z.string().trim().min(2).max(120),
    farmLocation: z.string().trim().min(2).max(300).optional(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  query: z.object({}),
  params: z.object({}),
});

export type CreateFarmerInput = z.infer<typeof createFarmerSchema>['body'];
