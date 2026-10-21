import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client.js';

// Everything the cart needs to decide whether a product can still be bought
const cartProductSelect = {
  id: true,
  name: true,
  price: true,
  unit: true,
  stock: true,
  isActive: true,
  deletedAt: true,
  farmer: {
    select: {
      id: true,
      userId: true,
      verificationStatus: true,
      farmName: true,
      farmLocation: true,
      latitude: true,
      longitude: true,
    },
  },
} as const;

export type CartProduct = Prisma.ProductGetPayload<{ select: typeof cartProductSelect }>;

export const findCartItems = (buyerId: string) => {
  return prisma.cartItem.findMany({
    where: { buyerId },
    orderBy: { createdAt: 'asc' },
    select: {
      productId: true,
      quantity: true,
      unitPriceAtAdd: true,
      product: { select: cartProductSelect },
    },
  });
};

export const findCartItem = (buyerId: string, productId: string) => {
  return prisma.cartItem.findUnique({
    where: { buyerId_productId: { buyerId, productId } },
    select: { quantity: true },
  });
};

export const countCartItems = (buyerId: string) => {
  return prisma.cartItem.count({ where: { buyerId } });
};

export const findProductForCart = (productId: string) => {
  return prisma.product.findUnique({
    where: { id: productId },
    select: cartProductSelect,
  });
};

// Sets the quantity and records the current price, which the buyer has now seen
export const saveCartItem = (data: {
  buyerId: string;
  productId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
}) => {
  return prisma.cartItem.upsert({
    where: { buyerId_productId: { buyerId: data.buyerId, productId: data.productId } },
    create: {
      buyerId: data.buyerId,
      productId: data.productId,
      quantity: data.quantity,
      unitPriceAtAdd: data.unitPrice,
    },
    update: { quantity: data.quantity, unitPriceAtAdd: data.unitPrice },
  });
};

export const deleteCartItem = (buyerId: string, productId: string) => {
  return prisma.cartItem.deleteMany({ where: { buyerId, productId } });
};

export const deleteAllCartItems = (buyerId: string) => {
  return prisma.cartItem.deleteMany({ where: { buyerId } });
};
