import { z } from 'zod';

const orderStatus = z.enum(['PLACED', 'CONFIRMED', 'COMPLETED', 'CANCELLED']);
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const page = z.coerce.number().int().min(1).optional();
const limit = z.coerce.number().int().min(1).max(100).optional();

const orderIdParams = z.object({
  orderId: z.string().uuid(),
});

export const checkoutSchema = z.object({
  body: z
    .object({
      items: z
        .array(
          z.object({
            productId: z.string().uuid(),
            quantity: z.number().int().min(1).max(1000),
          })
        )
        .min(1)
        .max(50),
      fulfilmentType: z.enum(['DELIVERY', 'PICKUP']),
      timeSlot: z.string().trim().min(1).max(20),
      contact: z
        .object({
          name: z.string().trim().min(2).max(100),
          phone: z.string().trim().regex(/^\+[1-9]\d{7,14}$/, 'Phone must be in E.164 format'),
        })
        .optional(),
      address: z
        .object({
          line1: z.string().trim().min(3).max(200),
          line2: z.string().trim().max(200).optional(),
          city: z.string().trim().min(2).max(100),
          pincode: z.string().trim().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
        })
        .optional(),
    })
    .refine(
      (body) => body.fulfilmentType !== 'DELIVERY' || body.address !== undefined,
      { message: 'Address is required for delivery', path: ['address'] }
    ),
  query: z.object({}),
  params: z.object({}),
});

export const buyerOrdersSchema = z.object({
  body: z.unknown(),
  query: z.object({ page, limit, status: orderStatus.optional() }),
  params: z.object({}),
});

export const farmerOrdersSchema = z.object({
  body: z.unknown(),
  query: z.object({ date: dateString.optional(), status: orderStatus.optional() }),
  params: z.object({}),
});

export const adminOrdersSchema = z.object({
  body: z.unknown(),
  query: z.object({ page, limit, date: dateString.optional(), status: orderStatus.optional() }),
  params: z.object({}),
});

export const orderIdSchema = z.object({
  body: z.unknown(),
  query: z.object({}),
  params: orderIdParams,
});

export const cancelOrderSchema = z.object({
  body: z.object({ reason: z.string().trim().min(1).max(300).optional() }).optional(),
  query: z.object({}),
  params: orderIdParams,
});

export const updateOrderStatusSchema = z.object({
  body: z.object({ status: z.enum(['CONFIRMED', 'COMPLETED']) }),
  query: z.object({}),
  params: orderIdParams,
});

export type CheckoutInput = z.infer<typeof checkoutSchema>['body'];
export type BuyerOrdersQuery = z.infer<typeof buyerOrdersSchema>['query'];
export type FarmerOrdersQuery = z.infer<typeof farmerOrdersSchema>['query'];
export type AdminOrdersQuery = z.infer<typeof adminOrdersSchema>['query'];
