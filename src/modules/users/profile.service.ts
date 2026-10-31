import { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors/app-error.js';
import { findProfile, updateProfile } from './profile.repository.js';
import { UpdateProfileInput } from './profile.schemas.js';

type Profile = NonNullable<Awaited<ReturnType<typeof findProfile>>>;

// farmerStatus tells the app which screens to show, whether or not the user ever applied
const toResponse = ({ farmerProfile, ...user }: Profile) => ({
  ...user,
  farmerStatus: farmerProfile?.verificationStatus ?? ('NONE' as const),
  farmer: farmerProfile,
});

export const getMyProfile = async (userId: string) => {
  const profile = await findProfile(userId);

  if (!profile) {
    throw new AppError('User not found', 404);
  }

  return toResponse(profile);
};

export const updateMyProfile = async (userId: string, input: UpdateProfileInput) => {
  try {
    return toResponse(await updateProfile(userId, input));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError('Email is already registered', 409);
    }
    throw error;
  }
};
