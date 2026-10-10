import { z } from 'zod';

const requestSchema = <T extends z.ZodType>(body: T) => z.object({
  body,
  query: z.object({}),
  params: z.object({}),
});

export const farmerApplicationSchema = requestSchema(z.object({
  farmName: z.string().trim().min(2).max(120),
  farmLocation: z.string().trim().min(2).max(300).optional(),
}));

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
export type ReviewFarmerApplicationInput = z.infer<typeof reviewFarmerApplicationSchema>['body'];