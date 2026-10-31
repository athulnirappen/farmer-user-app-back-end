import { randomUUID } from 'node:crypto';
import { UserRole, VerificationStatus } from '@prisma/client';
import supertest from 'supertest';
import app from '../src/app.js';
import { API_PREFIX } from '../src/config/constants.js';
import { PRODUCT_DECLARATION } from '../src/modules/products/product.declaration.js';
import { prisma } from '../src/prisma/client.js';
import { generateToken } from '../src/shared/utils/jwt.js';

const http = supertest(app);

export const api = {
  get: (path: string) => http.get(`${API_PREFIX}${path}`),
  post: (path: string) => http.post(`${API_PREFIX}${path}`),
  patch: (path: string) => http.patch(`${API_PREFIX}${path}`),
  delete: (path: string) => http.delete(`${API_PREFIX}${path}`),
};

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export const resetDatabase = () =>
  prisma.$executeRawUnsafe(`
    TRUNCATE "User", "OtpChallenge", "Category" RESTART IDENTITY CASCADE
  `);

let phoneCounter = 0;
const nextPhone = () => `+9198${String(++phoneCounter).padStart(8, '0')}`;

export const createUser = async (role: UserRole = UserRole.USER) => {
  const user = await prisma.user.create({
    data: { name: 'Test Person', phone: nextPhone(), phoneVerified: true, role },
  });
  return { user, token: generateToken({ sub: user.id, role: user.role }) };
};

export const createFarmer = async (
  verificationStatus: VerificationStatus = VerificationStatus.APPROVED
) => {
  const { user, token } = await createUser();
  const farm = await prisma.farmerProfile.create({
    data: {
      userId: user.id,
      farmName: 'Test Farm',
      farmLocation: 'Test Village',
      latitude: 10,
      longitude: 76,
      verificationStatus,
    },
  });
  return { user, token, farm };
};

export const createCategory = () => {
  const suffix = randomUUID();
  return prisma.category.create({ data: { name: `Category ${suffix}`, slug: `category-${suffix}` } });
};

export const createProduct = (
  farmId: string,
  categoryId: string,
  data: { price?: number; stock?: number } = {}
) =>
  prisma.product.create({
    data: {
      name: 'Tomato',
      price: data.price ?? 40,
      stock: data.stock ?? 10,
      unit: 'kg',
      farmId,
      categoryId,
      declarationVersion: PRODUCT_DECLARATION.version,
      declarationAcceptedAt: new Date(),
    },
  });

export { prisma };
