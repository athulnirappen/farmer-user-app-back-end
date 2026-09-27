import { AppError } from '../../shared/errors/app-error.js';
import { generateToken } from '../../shared/utils/jwt.js';
import { createRefreshTokenMaterial } from './auth.tokens.js';
import {
  removeExpiredRefreshTokens,
  revokeRefreshToken,
  rotateRefreshToken,
} from './auth.repository.js';
import { RefreshTokenInput } from './auth.session.schemas.js';

export const refreshSession = async ({ refreshToken }: RefreshTokenInput) => {
  const replacement = createRefreshTokenMaterial();
  const result = await rotateRefreshToken({
    refreshToken,
    replacementTokenHash: replacement.refreshTokenHash,
    replacementTokenExpiresAt: replacement.refreshTokenExpiresAt,
    now: new Date(),
  });

  if (result.status === 'reuse') {
    throw new AppError('Refresh token reuse detected; sign in again', 401);
  }

  if (result.status !== 'rotated') {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  return {
    user: result.user,
    accessToken: generateToken({ sub: result.user.id, role: result.user.role }),
    refreshToken: replacement.refreshToken,
  };
};

export const logoutSession = async ({ refreshToken }: RefreshTokenInput) => {
  await revokeRefreshToken(refreshToken);
  return { message: 'Logged out successfully' };
};

export const cleanupRefreshTokens = removeExpiredRefreshTokens;