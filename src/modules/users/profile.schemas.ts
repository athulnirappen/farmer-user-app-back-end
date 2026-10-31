import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(100).optional(),
      email: z.string().trim().email().toLowerCase().optional(),
    })
    .refine((body) => body.name !== undefined || body.email !== undefined, {
      message: 'Provide name or email',
    }),
  query: z.object({}),
  params: z.object({}),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];
