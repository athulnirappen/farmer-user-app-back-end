import { VerificationStatus } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { distanceKmSql, NearbyPoint, withinRadiusSql } from '../../shared/utils/geo.js';

const farmerApplicationSelect = {
  id: true,
  userId: true,
  farmName: true,
  farmLocation: true,
  latitude: true,
  longitude: true,
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

type FarmLocationData = {
  farmLocation?: string;
  latitude?: number;
  longitude?: number;
};

export const createFarmerApplication = (data: {
  userId: string;
  farmName: string;
} & FarmLocationData) => {
  return prisma.farmerProfile.create({
    data: {
      userId: data.userId,
      farmName: data.farmName,
      farmLocation: data.farmLocation ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
    },
    select: farmerApplicationSelect,
  });
};

export const resubmitRejectedFarmerApplication = (
  applicationId: string,
  data: { farmName: string } & FarmLocationData
) => {
  return prisma.farmerProfile.updateMany({
    where: {
      id: applicationId,
      verificationStatus: VerificationStatus.REJECTED,
    },
    data: {
      farmName: data.farmName,
      farmLocation: data.farmLocation ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
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

// Only the fields that were sent are changed, so a farmer can move the pin without retyping the address
export const updateFarmLocation = (farmId: string, data: FarmLocationData) => {
  return prisma.farmerProfile.update({
    where: { id: farmId },
    data: {
      ...(data.farmLocation !== undefined && { farmLocation: data.farmLocation }),
      ...(data.latitude !== undefined && { latitude: data.latitude, longitude: data.longitude }),
    },
    select: farmerApplicationSelect,
  });
};

export const NEARBY_FARMS_LIMIT = 100;

// Approved farms with a map pin inside the radius, nearest first, for showing on a map
export const findNearbyApprovedFarms = (point: NearbyPoint) => {
  return prisma.$queryRaw<{
    id: string;
    farmName: string;
    farmLocation: string | null;
    latitude: number;
    longitude: number;
    distanceKm: number;
    productCount: number;
  }[]>`
    SELECT
      fp."id",
      fp."farmName",
      fp."farmLocation",
      fp."latitude",
      fp."longitude",
      ${distanceKmSql(point)} AS "distanceKm",
      (
        SELECT COUNT(*)::int FROM "Product" p
        WHERE p."farmId" = fp."id" AND p."deletedAt" IS NULL AND p."isActive" = true
      ) AS "productCount"
    FROM "FarmerProfile" fp
    WHERE fp."verificationStatus" = 'APPROVED' AND ${withinRadiusSql(point)}
    ORDER BY "distanceKm" ASC
    LIMIT ${NEARBY_FARMS_LIMIT}
  `;
};
