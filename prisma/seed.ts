import { UserRole, VerificationStatus } from '@prisma/client';
import { env } from '../src/config/env.js';
import { PRODUCT_DECLARATION } from '../src/modules/products/product.declaration.js';
import { prisma } from '../src/prisma/client.js';
import { hashPassword } from '../src/shared/utils/password.js';

// Local development data. Safe to run twice: everything is matched on a fixed key first.
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@farmer.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'admin-password';
const FARMER_PHONE = '+919800000001';
const PENDING_FARMER_PHONE = '+919800000002';
const BUYER_PHONE = '+919800000003';

const CATEGORIES = [
  { name: 'Vegetables', slug: 'vegetables' },
  { name: 'Fruits', slug: 'fruits' },
  { name: 'Dairy', slug: 'dairy' },
  { name: 'Grains', slug: 'grains' },
];

const PRODUCTS = [
  { name: 'Tomato', price: 40, stock: 100, unit: 'kg', category: 'vegetables' },
  { name: 'Spinach', price: 30, stock: 50, unit: 'bunch', category: 'vegetables' },
  { name: 'Banana', price: 60, stock: 80, unit: 'dozen', category: 'fruits' },
  { name: 'Fresh Milk', price: 56, stock: 40, unit: 'litre', category: 'dairy' },
  { name: 'Matta Rice', price: 72, stock: 200, unit: 'kg', category: 'grains' },
];

const seedUser = (phone: string, name: string) =>
  prisma.user.upsert({
    where: { phone },
    update: {},
    create: { phone, name, phoneVerified: true, role: UserRole.USER },
  });

const seed = async () => {
  if (env.NODE_ENV === 'production') {
    throw new Error('The seed script is for local development only');
  }

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      name: 'Local Admin',
      passwordHash: await hashPassword(ADMIN_PASSWORD),
      role: UserRole.ADMIN,
    },
  });

  const categories = new Map<string, string>();
  for (const category of CATEGORIES) {
    const saved = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    });
    categories.set(category.slug, saved.id);
  }

  await seedUser(BUYER_PHONE, 'Sample Buyer');

  const farmer = await seedUser(FARMER_PHONE, 'Sample Farmer');
  const farm = await prisma.farmerProfile.upsert({
    where: { userId: farmer.id },
    update: {},
    create: {
      userId: farmer.id,
      farmName: 'Sample Green Farm',
      farmLocation: 'Thrissur, Kerala',
      latitude: 10.5276,
      longitude: 76.2144,
      verificationStatus: VerificationStatus.APPROVED,
    },
  });

  const pendingFarmer = await seedUser(PENDING_FARMER_PHONE, 'Pending Farmer');
  await prisma.farmerProfile.upsert({
    where: { userId: pendingFarmer.id },
    update: {},
    create: {
      userId: pendingFarmer.id,
      farmName: 'Awaiting Review Farm',
      farmLocation: 'Palakkad, Kerala',
      latitude: 10.7867,
      longitude: 76.6548,
    },
  });

  for (const { category, ...product } of PRODUCTS) {
    const existing = await prisma.product.findFirst({
      where: { farmId: farm.id, name: product.name },
    });
    if (existing) continue;

    await prisma.product.create({
      data: {
        ...product,
        farmId: farm.id,
        categoryId: categories.get(category)!,
        declarationVersion: PRODUCT_DECLARATION.version,
        declarationAcceptedAt: new Date(),
      },
    });
  }

  console.log(`Seeded. Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`Phones - farmer: ${FARMER_PHONE}, pending farmer: ${PENDING_FARMER_PHONE}, buyer: ${BUYER_PHONE}`);
};

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
