import { VerificationStatus } from '@prisma/client';

// Fields needed to decide whether buyers can see and order a product. The same rule is
// written as visibleWhere and as raw SQL in product.repository.ts; keep all three in step.
export const sellableProductSelect = {
  isActive: true,
  deletedAt: true,
  hiddenAt: true,
} as const;

export const sellableFarmerSelect = {
  verificationStatus: true,
  user: { select: { isActive: true } },
} as const;

type SellableProduct = {
  isActive: boolean;
  deletedAt: Date | null;
  hiddenAt: Date | null;
  farmer: { verificationStatus: VerificationStatus; user: { isActive: boolean } };
};

export const isSellable = (product: SellableProduct) =>
  product.deletedAt === null &&
  product.hiddenAt === null &&
  product.isActive &&
  product.farmer.verificationStatus === VerificationStatus.APPROVED &&
  product.farmer.user.isActive;
