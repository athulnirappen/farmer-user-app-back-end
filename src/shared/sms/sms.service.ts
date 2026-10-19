import { env } from '../../config/env.js';
import { consoleSmsProvider } from './console.provider.js';
import { SmsProvider } from './sms.types.js';

// Add a real provider here (and to SMS_PROVIDER in env.ts) to send actual SMS
const providers: Record<typeof env.SMS_PROVIDER, SmsProvider> = {
  console: consoleSmsProvider,
};

export const sendOtpSms = (phone: string, code: string) =>
  providers[env.SMS_PROVIDER].sendOtp(phone, code);
