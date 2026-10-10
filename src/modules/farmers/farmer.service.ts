import { Prisma, VerificationStatus } from '@prisma/client';
import { AppError } from '../../shared/errors/app-error.js';
import {
  createFarmerApplication,
  findFarmerApplicationById,
  findFarmerApplicationByUserId,
  findPendingFarmerApplications,
  updatePendingFarmerApplication,
} from './farmer.repository.js';
import { FarmerApplicationInput } from './farmer.schemas.js';

export const applyToBecomeFarmer = async (userId: string, input: FarmerApplicationInput) => {
  const existingApplication = await findFarmerApplicationByUserId(userId);

  if (existingApplication) {
    throw new AppError('A farmer application already exists for this account', 409);
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

export const listPendingFarmerApplications = () => findPendingFarmerApplications();

export const reviewFarmerApplication = async (
  applicationId: string,
  status: Exclude<VerificationStatus, 'PENDING'>
) => {
  const result = await updatePendingFarmerApplication(applicationId, status);

  if (result.count !== 1) {
    const application = await findFarmerApplicationById(applicationId);
    if (!application) {
      throw new AppError('Farmer application not found', 404);
    }
    throw new AppError('Farmer application has already been reviewed', 409);
  }

  return findFarmerApplicationById(applicationId);
};