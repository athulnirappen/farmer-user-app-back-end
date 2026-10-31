import { z } from 'zod';
import { MAX_RADIUS_KM } from '../../shared/utils/geo.js';

const requestSchema = <T extends z.ZodType>(body: T) => z.object({
  body,
  query: z.object({}),
  params: z.object({}),
});

const farmLocationField = z.string().trim().min(2).max(300);

// Map pin for the farm; the app picks it with Google Maps and sends both values
const coordinateFields = {
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
};

const hasBothOrNeitherCoordinate = (value: { latitude?: number; longitude?: number }) =>
  (value.latitude === undefined) === (value.longitude === undefined);

const coordinatePairMessage = {
  message: 'Provide both latitude and longitude, or neither',
  path: ['latitude'],
};

// The pin is required here: without one a farm never appears in near-me results
export const farmerApplicationSchema = requestSchema(z.object({
  farmName: z.string().trim().min(2).max(120),
  farmLocation: farmLocationField.optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
}));

export const updateFarmLocationSchema = requestSchema(z.object({
  farmLocation: farmLocationField.optional(),
  ...coordinateFields,
})
  .refine(hasBothOrNeitherCoordinate, coordinatePairMessage)
  .refine(
    (value) => value.farmLocation !== undefined || value.latitude !== undefined,
    'Provide farmLocation or latitude and longitude'
  ));

// Query values arrive as strings; check presence first so a missing value isn't reported as NaN
const requiredCoordinate = (name: string, limit: number) =>
  z
    .string({ error: `${name} is required` })
    .trim()
    .min(1, `${name} is required`)
    .transform(Number)
    .pipe(
      z
        .number({ error: `${name} must be a number` })
        .min(-limit, `${name} must be between -${limit} and ${limit}`)
        .max(limit, `${name} must be between -${limit} and ${limit}`)
    );

export const nearbyFarmsSchema = z.object({
  body: z.unknown(),
  query: z.object({
    lat: requiredCoordinate('lat', 90),
    lng: requiredCoordinate('lng', 180),
    radiusKm: z.coerce.number().min(1).max(MAX_RADIUS_KM).optional(),
  }),
  params: z.object({}),
});

export const farmIdSchema = z.object({
  body: z.unknown(),
  query: z.object({}),
  params: z.object({ farmId: z.string().uuid() }),
});

export const farmerApplicationsSchema = z.object({
  body: z.unknown(),
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    search: z.string().trim().min(1).max(120).optional(),
  }),
  params: z.object({}),
});

export const reviewFarmerApplicationSchema = z.object({
  body: z
    .object({
      status: z.enum(['APPROVED', 'REJECTED']),
      reason: z.string().trim().min(1).max(300).optional(),
    })
    .refine((body) => body.status !== 'REJECTED' || body.reason !== undefined, {
      message: 'A reason is required to reject or revoke a farmer',
      path: ['reason'],
    }),
  query: z.object({}),
  params: z.object({
    applicationId: z.string().uuid(),
  }),
});

export type FarmerApplicationInput = z.infer<typeof farmerApplicationSchema>['body'];
export type UpdateFarmLocationInput = z.infer<typeof updateFarmLocationSchema>['body'];
export type NearbyFarmsQuery = z.infer<typeof nearbyFarmsSchema>['query'];
export type FarmerApplicationsQuery = z.infer<typeof farmerApplicationsSchema>['query'];
export type ReviewFarmerApplicationInput = z.infer<typeof reviewFarmerApplicationSchema>['body'];
