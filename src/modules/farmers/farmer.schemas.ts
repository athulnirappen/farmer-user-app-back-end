import { z } from 'zod';

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

export const farmerApplicationSchema = requestSchema(z.object({
  farmName: z.string().trim().min(2).max(120),
  farmLocation: farmLocationField.optional(),
  ...coordinateFields,
}).refine(hasBothOrNeitherCoordinate, coordinatePairMessage));

export const updateFarmLocationSchema = requestSchema(z.object({
  farmLocation: farmLocationField.optional(),
  ...coordinateFields,
})
  .refine(hasBothOrNeitherCoordinate, coordinatePairMessage)
  .refine(
    (value) => value.farmLocation !== undefined || value.latitude !== undefined,
    'Provide farmLocation or latitude and longitude'
  ));

export const reviewFarmerApplicationSchema = z.object({
  body: z.object({
    status: z.enum(['APPROVED', 'REJECTED']),
  }),
  query: z.object({}),
  params: z.object({
    applicationId: z.string().uuid(),
  }),
});

export type FarmerApplicationInput = z.infer<typeof farmerApplicationSchema>['body'];
export type UpdateFarmLocationInput = z.infer<typeof updateFarmLocationSchema>['body'];
export type ReviewFarmerApplicationInput = z.infer<typeof reviewFarmerApplicationSchema>['body'];
