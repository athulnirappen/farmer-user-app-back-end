import { z } from 'zod';

const credentials = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
});

export const adminRegisterSchema = z.object({
  body: credentials.extend({
    name: z.string().trim().min(2).max(100),
  }),
  query: z.object({}),
  params: z.object({}),
});

export const adminLoginSchema = z.object({
  body: credentials,
  query: z.object({}),
  params: z.object({}),
});

export type AdminRegisterInput = z.infer<typeof adminRegisterSchema>['body'];
export type AdminLoginInput = z.infer<typeof adminLoginSchema>['body'];