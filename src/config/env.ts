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
  SMS_PROVIDER: z.enum(['console']).default('console'),
  BUSINESS_TIMEZONE: z.string().default('Asia/Kolkata').refine((value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'BUSINESS_TIMEZONE must be a valid IANA time zone'),
  ORDER_CUTOFF_HOUR: z.string().default('21').transform(Number).refine(
    (value) => Number.isInteger(value) && value >= 0 && value <= 24,
    'ORDER_CUTOFF_HOUR must be an integer from 0 to 24'
  ),
  TRUST_PROXY: z.string().default('0').transform(Number).refine(
    (value) => Number.isInteger(value) && value >= 0,
    'TRUST_PROXY must be a non-negative integer'
  ),
  // Comma-separated browser origins allowed to call the API
  CORS_ORIGINS: z.string().default('http://localhost:5173').transform((value) =>
    value.split(',').map((origin) => origin.trim()).filter(Boolean)
  ),
  // Folder for uploaded images while they are stored on this machine
  UPLOADS_DIR: z.string().default('uploads'),
  RATE_LIMIT_MAX: z.string().default('1000').transform((val) => parseInt(val, 10)),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform((val) => parseInt(val, 10)), // 15 mins default
}).superRefine((value, ctx) => {
  if (value.NODE_ENV === 'production' && value.SMS_PROVIDER === 'console') {
    ctx.addIssue({
      code: 'custom',
      path: ['SMS_PROVIDER'],
      message: 'SMS_PROVIDER=console only logs codes; configure a real provider for production',
    });
  }
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
