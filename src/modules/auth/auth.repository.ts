import { OtpPurpose, User, UserRole } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { hashRefreshToken } from '../../shared/utils/refresh-token.js';

export type AuthUser = Pick<User, 'id' | 'name' | 'email' | 'role' | 'isActive' | 'passwordHash'>;

export const findUserByEmail = (email: string): Promise<AuthUser | null> => {
  return prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      passwordHash: true,
    },
  });
};

export const createAdmin = (data: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<AuthUser> => {
  return prisma.user.create({
    data: { ...data, role: UserRole.ADMIN },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      passwordHash: true,
    },
  });
};

export const storeRefreshToken = async (data: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
} ): Promise<void> => {
  await prisma.refreshToken.create({
    data,
    select: { id: true },
  });
};

const refreshUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
} as const;

export const rotateRefreshToken = async (data: {
  refreshToken: string;
  replacementTokenHash: string;
  replacementTokenExpiresAt: Date;
  now: Date;
}) => {
  const tokenHash = hashRefreshToken(data.refreshToken);

  return prisma.$transaction(async (transaction) => {
    const current = await transaction.refreshToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        revokedAt: true,
        user: { select: refreshUserSelect },
      },
    });

    if (!current) {
      return { status: 'invalid' as const };
    }

    if (current.revokedAt) {
      await transaction.refreshToken.updateMany({
        where: { userId: current.userId, revokedAt: null },
        data: { revokedAt: data.now },
      });
      return { status: 'reuse' as const };
    }

    if (current.expiresAt <= data.now) {
      return { status: 'expired' as const };
    }

    const consumed = await transaction.refreshToken.updateMany({
      where: { id: current.id, revokedAt: null, expiresAt: { gt: data.now } },
      data: { revokedAt: data.now },
    });

    if (consumed.count !== 1) {
      await transaction.refreshToken.updateMany({
        where: { userId: current.userId, revokedAt: null },
        data: { revokedAt: data.now },
      });
      return { status: 'reuse' as const };
    }

    if (!current.user.isActive) {
      return { status: 'inactive' as const };
    }

    await transaction.refreshToken.create({
      data: {
        userId: current.userId,
        tokenHash: data.replacementTokenHash,
        expiresAt: data.replacementTokenExpiresAt,
      },
    });

    return { status: 'rotated' as const, user: current.user };
  });
};

export const revokeRefreshToken = async (refreshToken: string): Promise<void> => {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

export const removeExpiredRefreshTokens = async (): Promise<number> => {
  const result = await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });
  return result.count;
};

export const findUserByPhone = (phone: string) => {
  return prisma.user.findUnique({
    where: { phone },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      phoneVerified: true,
    },
  });
};

export const findUserByEmailAddress = (email: string) => {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
};

export const createOtpChallenge = async (data: {
  phone: string;
  purpose: OtpPurpose;
  name?: string;
  email?: string;
  codeHash: string;
  expiresAt: Date;
  resendAfter: Date;
  requestsSince: Date;
  maxRequestsPerHour: number;
}) => {
  return prisma.$transaction(async (transaction) => {
    const [recentRequestCount, recentRequest] = await Promise.all([
      transaction.otpChallenge.count({
        where: { phone: data.phone, createdAt: { gte: data.requestsSince } },
      }),
      transaction.otpChallenge.findFirst({
        where: { phone: data.phone },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    if (recentRequest && recentRequest.createdAt > data.resendAfter) {
      return { status: 'cooldown' as const };
    }

    if (recentRequestCount >= data.maxRequestsPerHour) {
      return { status: 'hourly-limit' as const };
    }

    await transaction.otpChallenge.updateMany({
      where: {
        phone: data.phone,
        purpose: data.purpose,
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });

    const challenge = await transaction.otpChallenge.create({
      data: {
        phone: data.phone,
        purpose: data.purpose,
        name: data.name,
        email: data.email,
        codeHash: data.codeHash,
        expiresAt: data.expiresAt,
      },
      select: { id: true },
    });

    return { status: 'created' as const, id: challenge.id };
  });
};

export const invalidateOtpChallenge = async (id: string): Promise<void> => {
  await prisma.otpChallenge.updateMany({
    where: { id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
};

export const findLatestOtpChallenge = (phone: string, purpose: OtpPurpose) => {
  return prisma.otpChallenge.findFirst({
    where: {
      phone,
      purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const incrementOtpAttempts = async (id: string): Promise<void> => {
  await prisma.otpChallenge.updateMany({
    where: { id, consumedAt: null },
    data: { attempts: { increment: 1 } },
  });
};

type BuyerSessionData = {
  challengeId: string;
  phone: string;
  refreshTokenHash: string;
  refreshTokenExpiresAt: Date;
  now: Date;
  maxAttempts: number;
};

const sessionUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  buyerProfile: { select: { id: true } },
} as const;

export const completeBuyerRegistration = async (data: BuyerSessionData) => {
  return prisma.$transaction(async (transaction) => {
    const consumed = await transaction.otpChallenge.updateMany({
      where: {
        id: data.challengeId,
        phone: data.phone,
        purpose: OtpPurpose.REGISTER,
        consumedAt: null,
        expiresAt: { gt: data.now },
        attempts: { lt: data.maxAttempts },
      },
      data: { consumedAt: data.now },
    });

    if (consumed.count !== 1) {
      return null;
    }

    const challenge = await transaction.otpChallenge.findUniqueOrThrow({
      where: { id: data.challengeId },
      select: { name: true, email: true },
    });

    if (!challenge.name || !challenge.email) {
      throw new Error('Registration challenge is missing profile information');
    }

    return transaction.user.create({
      data: {
        name: challenge.name,
        email: challenge.email,
        phone: data.phone,
        phoneVerified: true,
        role: UserRole.USER,
        buyerProfile: { create: {} },
        refreshTokens: {
          create: {
            tokenHash: data.refreshTokenHash,
            expiresAt: data.refreshTokenExpiresAt,
          },
        },
      },
      select: sessionUserSelect,
    });
  });
};

export const completeBuyerLogin = async (data: BuyerSessionData) => {
  return prisma.$transaction(async (transaction) => {
    const consumed = await transaction.otpChallenge.updateMany({
      where: {
        id: data.challengeId,
        phone: data.phone,
        purpose: OtpPurpose.LOGIN,
        consumedAt: null,
        expiresAt: { gt: data.now },
        attempts: { lt: data.maxAttempts },
      },
      data: { consumedAt: data.now },
    });

    if (consumed.count !== 1) {
      return null;
    }

    const user = await transaction.user.findUnique({
      where: { phone: data.phone },
      select: { id: true, role: true, isActive: true },
    });

    if (!user || user.role !== UserRole.USER || !user.isActive) {
      return null;
    }

    return transaction.user.update({
      where: { id: user.id },
      data: {
        phoneVerified: true,
        refreshTokens: {
          create: {
            tokenHash: data.refreshTokenHash,
            expiresAt: data.refreshTokenExpiresAt,
          },
        },
      },
      select: sessionUserSelect,
    });
  });
};