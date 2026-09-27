import { z } from 'zod';

const refreshToken = z.string().min(1).max(512);

export const refreshTokenSchema = z.object({
  body: z.object({ refreshToken }),
  query: z.object({}),
  params: z.object({}),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>['body'];