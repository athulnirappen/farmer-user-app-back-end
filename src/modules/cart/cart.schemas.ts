import { z } from 'zod';

const productIdParams = z.object({
  productId: z.string().uuid(),
});

// Same per-line limit as checkout
const quantity = z.number().int().min(1).max(1000);

export const addCartItemSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    quantity,
  }),
  query: z.object({}),
  params: z.object({}),
});

export const updateCartItemSchema = z.object({
  body: z.object({ quantity }),
  query: z.object({}),
  params: productIdParams,
});

export const cartItemIdSchema = z.object({
  body: z.unknown(),
  query: z.object({}),
  params: productIdParams,
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>['body'];
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>['body'];
