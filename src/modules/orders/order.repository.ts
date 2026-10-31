import { randomUUID } from 'node:crypto';
import {
  FulfilmentType,
  OrderStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import {
  isSellable,
  sellableFarmerSelect,
  sellableProductSelect,
} from '../products/product.visibility.js';

export const orderInclude = {
  items: {
    select: {
      id: true,
      productId: true,
      productName: true,
      unit: true,
      unitPrice: true,
      quantity: true,
      lineTotal: true,
    },
  },
  farmer: {
    select: {
      id: true,
      farmName: true,
      farmLocation: true,
      latitude: true,
      longitude: true,
      userId: true,
    },
  },
} as const;

// Buyer details are for admins only; farmers get the contact snapshot on the order
const adminOrderInclude = {
  ...orderInclude,
  buyer: { select: { id: true, name: true, email: true, phone: true } },
} as const;

export type CheckoutData = {
  buyerId: string;
  lines: { productId: string; quantity: number }[];
  fulfilmentType: FulfilmentType;
  timeSlot: string;
  deliveryDate: Date;
  contact: { name: string; phone: string };
  address?: { line1: string; line2?: string; city: string; pincode: string };
  // Checking out from the cart: remove the bought products from it in the same transaction
  clearCart?: boolean;
};

export const findBuyerContact = (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, phone: true },
  });
};

export const placeOrders = (data: CheckoutData) => {
  return prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: { id: { in: data.lines.map((line) => line.productId) } },
      select: {
        id: true,
        name: true,
        price: true,
        unit: true,
        stock: true,
        ...sellableProductSelect,
        farmId: true,
        farmer: {
          select: {
            userId: true,
            ...sellableFarmerSelect,
            farmName: true,
            farmLocation: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });
    const productsById = new Map(products.map((product) => [product.id, product]));
    const ordersByFarm = new Map<string, {
      lines: Prisma.OrderItemCreateWithoutOrderInput[];
      total: Prisma.Decimal;
      pickupLocation: string | null;
      pickupLatitude: number | null;
      pickupLongitude: number | null;
    }>();

    for (const line of data.lines) {
      const product = productsById.get(line.productId);
      if (!product || !isSellable(product)) {
        throw new AppError(`Product ${product?.name ?? line.productId} is not available`, 400);
      }
      if (product.farmer.userId === data.buyerId) {
        throw new AppError(`You can't order your own product (${product.name})`, 400);
      }
      if (data.fulfilmentType === FulfilmentType.PICKUP && !product.farmer.farmLocation) {
        throw new AppError(`Pickup isn't available for ${product.farmer.farmName}`, 400);
      }

      // Check and reserve stock in one statement so concurrent checkouts can't oversell
      const reserved = await tx.product.updateMany({
        where: { id: product.id, stock: { gte: line.quantity } },
        data: { stock: { decrement: line.quantity } },
      });
      if (reserved.count !== 1) {
        throw new AppError(`Only ${product.stock} ${product.unit} of ${product.name} left`, 409);
      }

      const lineTotal = product.price.mul(line.quantity);
      const farmOrder = ordersByFarm.get(product.farmId) ?? {
        lines: [],
        total: new Prisma.Decimal(0),
        pickupLocation: product.farmer.farmLocation,
        pickupLatitude: product.farmer.latitude,
        pickupLongitude: product.farmer.longitude,
      };
      farmOrder.lines.push({
        product: { connect: { id: product.id } },
        productName: product.name,
        unit: product.unit,
        unitPrice: product.price,
        quantity: line.quantity,
        lineTotal,
      });
      farmOrder.total = farmOrder.total.add(lineTotal);
      ordersByFarm.set(product.farmId, farmOrder);
    }

    const orderGroupId = randomUUID();
    const isDelivery = data.fulfilmentType === FulfilmentType.DELIVERY;
    const orders = [];

    for (const [farmId, farmOrder] of ordersByFarm) {
      orders.push(
        await tx.order.create({
          data: {
            orderGroupId,
            buyerId: data.buyerId,
            farmId,
            fulfilmentType: data.fulfilmentType,
            deliveryDate: data.deliveryDate,
            timeSlot: data.timeSlot,
            totalAmount: farmOrder.total,
            contactName: data.contact.name,
            contactPhone: data.contact.phone,
            addressLine1: isDelivery ? data.address?.line1 : null,
            addressLine2: isDelivery ? data.address?.line2 ?? null : null,
            city: isDelivery ? data.address?.city : null,
            pincode: isDelivery ? data.address?.pincode : null,
            pickupLocation: isDelivery ? null : farmOrder.pickupLocation,
            pickupLatitude: isDelivery ? null : farmOrder.pickupLatitude,
            pickupLongitude: isDelivery ? null : farmOrder.pickupLongitude,
            items: { create: farmOrder.lines },
          },
          include: orderInclude,
        })
      );
    }

    if (data.clearCart) {
      await tx.cartItem.deleteMany({
        where: { buyerId: data.buyerId, productId: { in: data.lines.map((line) => line.productId) } },
      });
    }

    return { orderGroupId, orders };
  });
};

export const findOrderById = (orderId: string) => {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: orderInclude,
  });
};

export const findOrders = (data: {
  where: Prisma.OrderWhereInput;
  orderBy: Prisma.OrderOrderByWithRelationInput[];
  skip?: number;
  take?: number;
}) => {
  return prisma.order.findMany({ ...data, include: orderInclude });
};

export const findAdminOrderById = (orderId: string) => {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: adminOrderInclude,
  });
};

export const findAdminOrders = (data: {
  where: Prisma.OrderWhereInput;
  orderBy: Prisma.OrderOrderByWithRelationInput[];
  skip: number;
  take: number;
}) => {
  return prisma.order.findMany({ ...data, include: adminOrderInclude });
};

export const countOrders = (where: Prisma.OrderWhereInput) => prisma.order.count({ where });

export const cancelOrderAndRestock = (data: {
  orderId: string;
  allowedStatuses: OrderStatus[];
  cancelledBy: 'BUYER' | 'FARMER' | 'ADMIN';
  reason?: string;
}) => {
  return prisma.$transaction(async (tx) => {
    const cancelled = await tx.order.updateMany({
      where: { id: data.orderId, status: { in: data.allowedStatuses } },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: data.cancelledBy,
        cancelReason: data.reason ?? null,
      },
    });
    if (cancelled.count !== 1) {
      return null;
    }

    const items = await tx.orderItem.findMany({
      where: { orderId: data.orderId },
      select: { productId: true, quantity: true },
    });
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }

    return tx.order.findUniqueOrThrow({ where: { id: data.orderId }, include: orderInclude });
  });
};

export const moveOrderStatus = (orderId: string, from: OrderStatus, to: OrderStatus) => {
  return prisma.order.updateMany({
    where: { id: orderId, status: from },
    data: { status: to },
  });
};
