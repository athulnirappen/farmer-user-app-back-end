import { z } from 'zod';
import { deliveryAddressFields } from '../users/address.schemas.js';

const orderStatus = z.enum(['PLACED', 'CONFIRMED', 'COMPLETED', 'CANCELLED']);
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const page = z.coerce.number().int().min(1).optional();
const limit = z.coerce.number().int().min(1).max(100).optional();

const orderIdParams = z.object({
  orderId: z.string().uuid(),
});

// How and when to fulfil an order; shared by checkout with items and checkout from the cart
const checkoutDetails = {
  fulfilmentType: z.enum(['DELIVERY', 'PICKUP']),
  timeSlot: z.string().trim().min(1).max(20),
  contact: z
    .object({
      name: z.string().trim().min(2).max(100),
      phone: z.string().trim().regex(/^\+[1-9]\d{7,14}$/, 'Phone must be in E.164 format'),
    })
    .optional(),
  // For delivery: a typed address, a saved one, or neither to use the buyer's default address
  address: z.object(deliveryAddressFields).optional(),
  addressId: z.string().uuid().optional(),
};

const hasAtMostOneAddress = (body: { address?: unknown; addressId?: unknown }) =>
  body.address === undefined || body.addressId === undefined;

const oneAddressMessage = { message: 'Send either address or addressId, not both', path: ['addressId'] };

export const checkoutSchema = z.object({
  body: z
    .object({
      items: z
        .array(
          z.object({
            productId: z.string().uuid(),
            quantity: z.number().int().min(1).max(1000),
            // The price the buyer saw; the order stops if it has changed since
            expectedPrice: z.number().positive().optional(),
          })
        )
        .min(1)
        .max(50),
      ...checkoutDetails,
    })
    .refine(hasAtMostOneAddress, oneAddressMessage),
  query: z.object({}),
  params: z.object({}),
});

export const checkoutFromCartSchema = z.object({
  body: z.object(checkoutDetails).refine(hasAtMostOneAddress, oneAddressMessage),
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
  query: z.object({ page, limit, date: dateString.optional(), status: orderStatus.optional() }),
  params: z.object({}),
});

export const adminOrdersSchema = z.object({
  body: z.unknown(),
  query: z.object({
    page,
    limit,
    date: dateString.optional(),
    status: orderStatus.optional(),
    farmId: z.string().uuid().optional(),
    buyerId: z.string().uuid().optional(),
  }),
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
export type CheckoutDetails = z.infer<typeof checkoutFromCartSchema>['body'];
export type BuyerOrdersQuery = z.infer<typeof buyerOrdersSchema>['query'];
export type FarmerOrdersQuery = z.infer<typeof farmerOrdersSchema>['query'];
export type AdminOrdersQuery = z.infer<typeof adminOrdersSchema>['query'];
