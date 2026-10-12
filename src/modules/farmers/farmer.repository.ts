import { VerificationStatus } from '@prisma/client';
import { prisma } from '../../prisma/client.js';

const farmerApplicationSelect = {
  id: true,
  userId: true,
  farmName: true,
  farmLocation: true,
  verificationStatus: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const findFarmerApplicationByUserId = (userId: string) => {
  return prisma.farmerProfile.findUnique({
    where: { userId },
    select: farmerApplicationSelect,
  });
};

export const createFarmerApplication = (data: {
  userId: string;
  farmName: string;
  farmLocation?: string;
}) => {
  return prisma.farmerProfile.create({
    data: {
      userId: data.userId,
      farmName: data.farmName,
      farmLocation: data.farmLocation ?? null,
    },
    select: farmerApplicationSelect,
  });
};

export const resubmitRejectedFarmerApplication = (
  applicationId: string,
  data: { farmName: string; farmLocation?: string }
) => {
  return prisma.farmerProfile.updateMany({
    where: {
      id: applicationId,
      verificationStatus: VerificationStatus.REJECTED,
    },
    data: {
      farmName: data.farmName,
      farmLocation: data.farmLocation ?? null,
      verificationStatus: VerificationStatus.PENDING,
    },
  });
};

export const findPendingFarmerApplications = () => {
  return prisma.farmerProfile.findMany({
    where: { verificationStatus: VerificationStatus.PENDING },
    orderBy: { createdAt: 'asc' },
    select: {
      ...farmerApplicationSelect,
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });
};

export const updatePendingFarmerApplication = (
  applicationId: string,
  status: Exclude<VerificationStatus, 'PENDING'>
) => {
  return prisma.farmerProfile.updateMany({
    where: {
      id: applicationId,
      verificationStatus: VerificationStatus.PENDING,
    },
    data: { verificationStatus: status },
  });
};

export const findFarmerApplicationById = (applicationId: string) => {
  return prisma.farmerProfile.findUnique({
    where: { id: applicationId },
    select: farmerApplicationSelect,
  });
};