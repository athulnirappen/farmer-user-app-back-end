import { z } from 'zod';

// The address an order is delivered to; checkout validates typed addresses with the same fields
export const deliveryAddressFields = {
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2).max(100),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
};

const label = z.string().trim().min(1).max(40);
const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

const hasBothOrNeitherCoordinate = (value: { latitude?: unknown; longitude?: unknown }) =>
  (value.latitude === undefined) === (value.longitude === undefined) &&
  (value.latitude === null) === (value.longitude === null);

const coordinatePairMessage = {
  message: 'Provide both latitude and longitude, or neither',
  path: ['latitude'],
};

const addressIdParams = z.object({
  addressId: z.string().uuid(),
});

export const createAddressSchema = z.object({
  body: z
    .object({
      label: label.optional(),
      ...deliveryAddressFields,
      latitude: latitude.optional(),
      longitude: longitude.optional(),
      isDefault: z.boolean().optional(),
    })
    .refine(hasBothOrNeitherCoordinate, coordinatePairMessage),
  query: z.object({}),
  params: z.object({}),
});

// null clears an optional field; the default is changed with POST /:addressId/default
export const updateAddressSchema = z.object({
  body: z
    .object({
      label: label.nullable().optional(),
      line1: deliveryAddressFields.line1.optional(),
      line2: deliveryAddressFields.line2.unwrap().nullable().optional(),
      city: deliveryAddressFields.city.optional(),
      pincode: deliveryAddressFields.pincode.optional(),
      latitude: latitude.nullable().optional(),
      longitude: longitude.nullable().optional(),
    })
    .refine(hasBothOrNeitherCoordinate, coordinatePairMessage)
    .refine(
      (body) => Object.values(body).some((value) => value !== undefined),
      'Provide at least one field to update'
    ),
  query: z.object({}),
  params: addressIdParams,
});

export const addressIdSchema = z.object({
  body: z.unknown(),
  query: z.object({}),
  params: addressIdParams,
});

export type CreateAddressInput = z.infer<typeof createAddressSchema>['body'];
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>['body'];
