import { OtpPurpose, UserRole } from '@prisma/client';
import { env } from '../../../config/env.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { generateToken } from '../../../shared/utils/jwt.js';
import { generateOtpCode, hashOtpCode, verifyOtpCode } from '../../../shared/utils/otp.js';
import {
  claimOtpAttempt,
  completeBuyerLogin,
  completeBuyerRegistration,
  createOtpChallenge,
  findLatestOtpChallenge,
  findUserByEmailAddress,
  findUserByPhone,
  invalidateOtpChallenge,
} from '../auth.repository.js';
import { createRefreshTokenMaterial } from '../auth.tokens.js';
import { RegisterOtpInput, StartUserAuthInput, VerifyOtpInput } from './user.schemas.js';
import { sendOtpSms } from './user.sms.js';

const requestOtp = async (data: {
  phone: string;
  purpose: OtpPurpose;
  name?: string;
  email?: string;
}) => {
  const now = new Date();
  const code = generateOtpCode();
  const result = await createOtpChallenge({
    ...data,
    codeHash: hashOtpCode(code),
    expiresAt: new Date(now.getTime() + env.OTP_EXPIRES_IN_MINUTES * 60 * 1000),
    resendAfter: new Date(now.getTime() - env.OTP_RESEND_COOLDOWN_SECONDS * 1000),
    requestsSince: new Date(now.getTime() - 60 * 60 * 1000),
    maxRequestsPerHour: env.OTP_MAX_REQUESTS_PER_HOUR,
  });

  if (result.status === 'cooldown') {
    throw new AppError('Please wait before requesting another code', 429);
  }
  if (result.status === 'hourly-limit') {
    throw new AppError('OTP request limit reached; try again later', 429);
  }

  try {
    await sendOtpSms(data.phone, code);
  } catch (error) {
    await invalidateOtpChallenge(result.id);
    throw error;
  }

  return { message: 'Verification code sent' };
};

export const startUserAuth = async (input: StartUserAuthInput) => {
  const user = await findUserByPhone(input.phone);

  if (!user) {
    return {
      nextStep: 'REGISTER' as const,
      message: 'Continue with your name and email to register',
    };
  }

  if (user.role !== UserRole.USER || !user.isActive) {
    throw new AppError('Unable to start sign-in with this phone number', 401);
  }

  await requestOtp({ phone: input.phone, purpose: OtpPurpose.LOGIN });
  return { nextStep: 'VERIFY_LOGIN' as const, message: 'Verification code sent' };
};

export const requestBuyerRegistrationOtp = async (input: RegisterOtpInput) => {
  const existingUser = await findUserByPhone(input.phone);
  if (existingUser) {
    throw new AppError('Phone number is already registered; start sign-in instead', 409);
  }

  const existingEmail = await findUserByEmailAddress(input.email);
  if (existingEmail) {
    throw new AppError('Email is already registered', 409);
  }

  return requestOtp({
    phone: input.phone,
    purpose: OtpPurpose.REGISTER,
    name: input.name,
    email: input.email,
  });
};

const verifyOtp = async (phone: string, purpose: OtpPurpose, code: string) => {
  const challenge = await findLatestOtpChallenge(phone, purpose);
  if (!challenge) {
    throw new AppError('Invalid or expired verification code', 401);
  }

  const claimed = await claimOtpAttempt(challenge.id, env.OTP_MAX_ATTEMPTS);
  if (!claimed || !verifyOtpCode(code, challenge.codeHash)) {
    throw new AppError('Invalid or expired verification code', 401);
  }

  return challenge;
};

export const verifyBuyerRegistrationOtp = async (input: VerifyOtpInput) => {
  const challenge = await verifyOtp(input.phone, OtpPurpose.REGISTER, input.code);
  const session = createRefreshTokenMaterial();

  try {
    const user = await completeBuyerRegistration({
      challengeId: challenge.id,
      phone: input.phone,
      refreshTokenHash: session.refreshTokenHash,
      refreshTokenExpiresAt: session.refreshTokenExpiresAt,
      now: new Date(),
      maxAttempts: env.OTP_MAX_ATTEMPTS,
    });

    if (!user) {
      throw new AppError('Invalid or expired verification code', 401);
    }

    return {
      user,
      accessToken: generateToken({
        sub: user.id,
        role: user.role,
      }),
      refreshToken: session.refreshToken,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      throw new AppError('Phone number or email is already registered', 409);
    }
    throw error;
  }
};

export const verifyBuyerLoginOtp = async (input: VerifyOtpInput) => {
  const challenge = await verifyOtp(input.phone, OtpPurpose.LOGIN, input.code);
  const session = createRefreshTokenMaterial();
  const user = await completeBuyerLogin({
    challengeId: challenge.id,
    phone: input.phone,
    refreshTokenHash: session.refreshTokenHash,
    refreshTokenExpiresAt: session.refreshTokenExpiresAt,
    now: new Date(),
    maxAttempts: env.OTP_MAX_ATTEMPTS,
  });

  if (!user) {
    throw new AppError('Invalid or expired verification code', 401);
  }

  return {
    user,
    accessToken: generateToken({
      sub: user.id,
      role: user.role,
    }),
    refreshToken: session.refreshToken,
  };
};