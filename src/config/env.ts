import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL cannot be empty'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ADMIN_REGISTRATION_SECRET: z.string().min(32, 'ADMIN_REGISTRATION_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN_DAYS: z.string().default('30').transform(Number).refine(
    (value) => Number.isInteger(value) && value > 0,
    'REFRESH_TOKEN_EXPIRES_IN_DAYS must be a positive integer'
  ),
  OTP_EXPIRES_IN_MINUTES: z.string().default('5').transform(Number).refine(
    (value) => Number.isInteger(value) && value > 0,
    'OTP_EXPIRES_IN_MINUTES must be a positive integer'
  ),
  OTP_MAX_ATTEMPTS: z.string().default('5').transform(Number).refine(
    (value) => Number.isInteger(value) && value > 0,
    'OTP_MAX_ATTEMPTS must be a positive integer'
  ),
  OTP_RESEND_COOLDOWN_SECONDS: z.string().default('60').transform(Number).refine(
    (value) => Number.isInteger(value) && value > 0,
    'OTP_RESEND_COOLDOWN_SECONDS must be a positive integer'
  ),
  OTP_MAX_REQUESTS_PER_HOUR: z.string().default('5').transform(Number).refine(
    (value) => Number.isInteger(value) && value > 0,
    'OTP_MAX_REQUESTS_PER_HOUR must be a positive integer'
  ),
  RATE_LIMIT_MAX: z.string().default('100').transform((val) => parseInt(val, 10)),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform((val) => parseInt(val, 10)), // 15 mins default
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }

  return result.data;
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
