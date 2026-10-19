import { logger } from '../../config/logger.js';
import { SmsProvider } from './sms.types.js';

// Logs the code instead of sending it. env.ts refuses this provider in production.
export const consoleSmsProvider: SmsProvider = {
  sendOtp: async (phone, code) => {
    logger.info({ phone, code }, 'Development OTP generated');
  },
};
