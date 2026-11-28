import { OtpPurpose, Prisma, UserRole } from '@prisma/client';
import { env } from '../../../config/env.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { generateToken } from '../../../shared/utils/jwt.js';
import { comparePassword, hashPassword } from '../../../shared/utils/password.js';
import { generateOtpCode, hashOtpCode, verifyOtpCode } from '../../../shared/utils/otp.js';
import {
  claimOtpAttempt,
  completeBuyerLogin,
  completeBuyerRegistration,
  createBuyerWithSession,
  createOtpChallenge,
  findBuyerLoginByEmail,
  findLatestOtpChallenge,
  findPasswordHash,
  findUserByEmailAddress,
  findUserByPhone,
  invalidateOtpChallenge,
  replacePassword,
  storeRefreshToken,
} from '../auth.repository.js';
import { createRefreshTokenMaterial } from '../auth.tokens.js';
import {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  RegisterOtpInput,
  StartUserAuthInput,
  VerifyOtpInput,
} from './user.schemas.js';
import { sendOtpSms } from '../../../shared/sms/sms.service.js';

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
// Email and password sign-in for the MVP, used while there is no SMS provider for OTP

// Compared against when the email is unknown, so a miss takes as long as a wrong password
const DUMMY_PASSWORD_HASH = hashPassword('not-a-real-password');

const signedIn = (user: { id: string; role: UserRole }, refreshToken: string) => ({
  accessToken: generateToken({ sub: user.id, role: user.role }),
  refreshToken,
});

export const registerBuyer = async (input: RegisterInput) => {
  if (await findUserByEmailAddress(input.email)) {
    throw new AppError('Email is already registered', 409);
  }
  if (await findUserByPhone(input.phone)) {
    throw new AppError('Phone number is already registered', 409);
  }

  const session = createRefreshTokenMaterial();
  try {
    const user = await createBuyerWithSession({
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash: await hashPassword(input.password),
      refreshTokenHash: session.refreshTokenHash,
      refreshTokenExpiresAt: session.refreshTokenExpiresAt,
    });
    return { user, ...signedIn(user, session.refreshToken) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError('Email or phone number is already registered', 409);
    }
    throw error;
  }
};

export const loginBuyer = async (input: LoginInput) => {
  const found = await findBuyerLoginByEmail(input.email);
  const passwordMatches = await comparePassword(
    input.password,
    found?.passwordHash ?? (await DUMMY_PASSWORD_HASH)
  );

  if (!found || !found.passwordHash || !passwordMatches || found.role !== UserRole.USER || !found.isActive) {
    throw new AppError('Invalid email or password', 401);
  }

  const session = createRefreshTokenMaterial();
  await storeRefreshToken({
    userId: found.id,
    tokenHash: session.refreshTokenHash,
    expiresAt: session.refreshTokenExpiresAt,
  });

  const { isActive: _isActive, passwordHash: _passwordHash, ...user } = found;
  return { user, ...signedIn(user, session.refreshToken) };
};

export const changePassword = async (userId: string, input: ChangePasswordInput) => {
  const found = await findPasswordHash(userId);
  if (!found?.passwordHash || found.role !== UserRole.USER || !found.isActive) {
    throw new AppError('Password sign-in is not set up for this account', 400);
  }
  if (!(await comparePassword(input.currentPassword, found.passwordHash))) {
    throw new AppError('Current password is incorrect', 401);
  }
  if (input.newPassword === input.currentPassword) {
    throw new AppError('Choose a password different from the current one', 400);
  }

  const session = createRefreshTokenMaterial();
  const user = await replacePassword({
    userId,
    passwordHash: await hashPassword(input.newPassword),
    refreshTokenHash: session.refreshTokenHash,
    refreshTokenExpiresAt: session.refreshTokenExpiresAt,
  });
  return { user, ...signedIn(user, session.refreshToken) };
};
