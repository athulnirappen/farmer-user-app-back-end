import { env } from '../../../config/env.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { logger } from '../../../config/logger.js';

export const sendOtpSms = async (phone: string, code: string): Promise<void> => {
  if (env.NODE_ENV !== 'development') {
    throw new AppError('SMS delivery is not configured', 503);
  }

  logger.debug({ phone, code }, 'Development OTP generated');
};