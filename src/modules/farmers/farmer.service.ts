import { Prisma, VerificationStatus } from '@prisma/client';
import { AppError } from '../../shared/errors/app-error.js';
import { DEFAULT_RADIUS_KM, roundKm } from '../../shared/utils/geo.js';
import { getPagination } from '../../shared/utils/pagination.js';
import { recordAdminAction } from '../admin/audit.repository.js';
import {
  applyFarmerReview,
  countFarmerApplications,
  createFarmerApplication,
  findFarmerApplicationById,
  findFarmerApplicationByUserId,
  findFarmerApplications,
  findNearbyApprovedFarms,
  findPendingFarmerApplications,
  resubmitRejectedFarmerApplication,
  updateFarmLocation,
} from './farmer.repository.js';
import {
  FarmerApplicationInput,
  FarmerApplicationsQuery,
  NearbyFarmsQuery,
  ReviewFarmerApplicationInput,
  UpdateFarmLocationInput,
} from './farmer.schemas.js';

export const applyToBecomeFarmer = async (userId: string, input: FarmerApplicationInput) => {
  const existingApplication = await findFarmerApplicationByUserId(userId);

  if (existingApplication) {
    if (existingApplication.verificationStatus !== VerificationStatus.REJECTED) {
      throw new AppError('A farmer application already exists for this account', 409);
    }

    const result = await resubmitRejectedFarmerApplication(existingApplication.id, input);
    if (result.count !== 1) {
      throw new AppError('A farmer application already exists for this account', 409);
    }
    return findFarmerApplicationById(existingApplication.id);
  }

  try {
    return await createFarmerApplication({ userId, ...input });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new AppError('A farmer application already exists for this account', 409);
    }
    throw error;
  }
};

export const getMyFarmerApplication = async (userId: string) => {
  const application = await findFarmerApplicationByUserId(userId);

  if (!application) {
    throw new AppError('Farmer application not found', 404);
  }

  return application;
};

export const updateMyFarmLocation = (farmId: string, input: UpdateFarmLocationInput) =>
  updateFarmLocation(farmId, input);

export const listNearbyFarms = async (query: NearbyFarmsQuery) => {
  const radiusKm = query.radiusKm ?? DEFAULT_RADIUS_KM;
  const farms = await findNearbyApprovedFarms({ lat: query.lat, lng: query.lng, radiusKm });

  return {
    radiusKm,
    items: farms.map((farm) => ({ ...farm, distanceKm: roundKm(farm.distanceKm) })),
  };
};

export const listPendingFarmerApplications = () => findPendingFarmerApplications();

export const listFarmerApplications = async (query: FarmerApplicationsQuery) => {
  const { page, limit, skip } = getPagination(query.page, query.limit);
  const [items, total] = await Promise.all([
    findFarmerApplications({ status: query.status, search: query.search, skip, take: limit }),
    countFarmerApplications({ status: query.status, search: query.search }),
  ]);

  return { items, page, limit, total };
};

// REJECTED also works on an approved farmer, which revokes them and takes their products off sale
export const reviewFarmerApplication = async (
  adminId: string,
  applicationId: string,
  { status, reason }: ReviewFarmerApplicationInput
) => {
  const from =
    status === VerificationStatus.REJECTED
      ? [VerificationStatus.PENDING, VerificationStatus.APPROVED]
      : [VerificationStatus.PENDING];
  const result = await applyFarmerReview({
    applicationId,
    from,
    status,
    reason,
    reviewedById: adminId,
  });

  if (result.count !== 1) {
    const application = await findFarmerApplicationById(applicationId);
    if (!application) {
      throw new AppError('Farmer application not found', 404);
    }
    throw new AppError('Farmer application has already been reviewed', 409);
  }

  await recordAdminAction({
    actorId: adminId,
    action: status === VerificationStatus.APPROVED ? 'FARMER_APPROVED' : 'FARMER_REJECTED',
    targetType: 'FARMER',
    targetId: applicationId,
    details: reason ? { reason } : undefined,
  });

  return findFarmerApplicationById(applicationId);
};