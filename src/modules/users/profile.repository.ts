import { prisma } from '../../prisma/client.js';
import { UpdateProfileInput } from './profile.schemas.js';

const profileSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  phoneVerified: true,
  role: true,
  createdAt: true,
  farmerProfile: {
    select: {
      id: true,
      farmName: true,
      farmLocation: true,
      latitude: true,
      longitude: true,
      verificationStatus: true,
      rejectionReason: true,
    },
  },
} as const;

export const findProfile = (userId: string) => {
  return prisma.user.findUnique({ where: { id: userId }, select: profileSelect });
};

export const updateProfile = (userId: string, data: UpdateProfileInput) => {
  return prisma.user.update({ where: { id: userId }, data, select: profileSelect });
};
