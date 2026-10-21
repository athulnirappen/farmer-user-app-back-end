import { OrderStatus, Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { getPagination } from '../../shared/utils/pagination.js';
import { getCart } from '../cart/cart.service.js';
import { ORDER_TIME_SLOTS, isKnownTimeSlot } from './order.constants.js';
import {
  cancelOrderAndRestock,
  countOrders,
  findBuyerContact,
  findOrderById,
  findOrders,
  moveOrderStatus,
  placeOrders,
} from './order.repository.js';
import {
  AdminOrdersQuery,
  BuyerOrdersQuery,
  CheckoutDetails,
  CheckoutInput,
  FarmerOrdersQuery,
} from './order.schemas.js';
import {
  isOrderingOpen,
  parseDateString,
  toDateString,
  tomorrowInBusinessTz,
} from './order.time.js';

type RequestUser = { id: string; role: 'ADMIN' | 'USER' };
type OrderWithFarmer = NonNullable<Awaited<ReturnType<typeof findOrderById>>>;

// Allowed farmer status moves: target -> required current status
const STATUS_TRANSITIONS: Record<'CONFIRMED' | 'COMPLETED', OrderStatus> = {
  CONFIRMED: OrderStatus.PLACED,
  COMPLETED: OrderStatus.CONFIRMED,
};

const accessTo = (order: OrderWithFarmer, user: RequestUser) => {
  if (order.buyerId === user.id) return 'BUYER' as const;
  if (order.farmer.userId === user.id) return 'FARMER' as const;
  if (user.role === 'ADMIN') return 'ADMIN' as const;
  return null;
};

const loadOrderFor = async (orderId: string, user: RequestUser) => {
  const order = await findOrderById(orderId);
  const access = order ? accessTo(order, user) : null;

  if (!order || !access) {
    throw new AppError('Order not found', 404);
  }

  return { order, access };
};

export const getOrderSlots = () => ({
  deliveryDate: toDateString(tomorrowInBusinessTz()),
  isOpen: isOrderingOpen(),
  cutoffHour: env.ORDER_CUTOFF_HOUR,
  timeZone: env.BUSINESS_TIMEZONE,
  slots: ORDER_TIME_SLOTS,
});

const placeCheckout = async (
  buyerId: string,
  items: { productId: string; quantity: number }[],
  details: CheckoutDetails,
  options: { clearCart?: boolean } = {}
) => {
  if (!isOrderingOpen()) {
    throw new AppError('Ordering for tomorrow is closed; it reopens at midnight', 409);
  }
  if (!isKnownTimeSlot(details.timeSlot)) {
    throw new AppError('Unknown time slot', 400);
  }

  let contact = details.contact;
  if (!contact) {
    const buyer = await findBuyerContact(buyerId);
    if (!buyer?.name || !buyer.phone) {
      throw new AppError('Contact name and phone are required', 400);
    }
    contact = { name: buyer.name, phone: buyer.phone };
  }

  // Merge repeated lines for the same product
  const quantities = new Map<string, number>();
  for (const item of items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }

  return placeOrders({
    buyerId,
    lines: [...quantities].map(([productId, quantity]) => ({ productId, quantity })),
    fulfilmentType: details.fulfilmentType,
    timeSlot: details.timeSlot,
    deliveryDate: tomorrowInBusinessTz(),
    contact,
    address: details.address,
    clearCart: options.clearCart,
  });
};

export const checkout = (buyerId: string, { items, ...details }: CheckoutInput) =>
  placeCheckout(buyerId, items, details);

export const checkoutFromCart = async (buyerId: string, details: CheckoutDetails) => {
  const cart = await getCart(buyerId);

  if (cart.itemCount === 0) {
    throw new AppError('Your cart is empty', 400);
  }
  // Stock and availability are checked again inside the order transaction; a price change
  // is only visible here, so make the buyer look at the new price before paying it
  const repriced = cart.items.filter((item) => item.issue === 'PRICE_CHANGED');
  if (repriced.length > 0) {
    throw new AppError(
      `Prices changed for ${repriced.map((item) => item.product.name).join(', ')}; review your cart`,
      409
    );
  }

  return placeCheckout(
    buyerId,
    cart.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    details,
    { clearCart: true }
  );
};

export const listBuyerOrders = async (buyerId: string, query: BuyerOrdersQuery) => {
  const { page, limit, skip } = getPagination(query.page, query.limit);
  const where: Prisma.OrderWhereInput = { buyerId, ...(query.status && { status: query.status }) };
  const [items, total] = await Promise.all([
    findOrders({ where, orderBy: [{ createdAt: 'desc' }], skip, take: limit }),
    countOrders(where),
  ]);

  return { items, page, limit, total };
};

export const listFarmerOrders = async (farmId: string, query: FarmerOrdersQuery) => {
  const deliveryDate = query.date ? parseDateString(query.date) : tomorrowInBusinessTz();
  const items = await findOrders({
    where: { farmId, deliveryDate, ...(query.status && { status: query.status }) },
    orderBy: [{ timeSlot: 'asc' }, { createdAt: 'asc' }],
  });

  return { deliveryDate: toDateString(deliveryDate), items };
};

export const listAllOrders = async (query: AdminOrdersQuery) => {
  const { page, limit, skip } = getPagination(query.page, query.limit);
  const where: Prisma.OrderWhereInput = {
    ...(query.date && { deliveryDate: parseDateString(query.date) }),
    ...(query.status && { status: query.status }),
  };
  const [items, total] = await Promise.all([
    findOrders({ where, orderBy: [{ createdAt: 'desc' }], skip, take: limit }),
    countOrders(where),
  ]);

  return { items, page, limit, total };
};

export const getOrder = async (orderId: string, user: RequestUser) => {
  const { order } = await loadOrderFor(orderId, user);
  return order;
};

export const cancelOrder = async (orderId: string, user: RequestUser, reason?: string) => {
  const { access } = await loadOrderFor(orderId, user);

  if (access === 'ADMIN') {
    throw new AppError('Insufficient permissions', 403);
  }

  const allowedStatuses =
    access === 'BUYER'
      ? [OrderStatus.PLACED]
      : [OrderStatus.PLACED, OrderStatus.CONFIRMED];
  const order = await cancelOrderAndRestock({
    orderId,
    allowedStatuses,
    cancelledBy: access,
    reason,
  });

  if (!order) {
    throw new AppError(
      access === 'BUYER'
        ? 'Only orders that are not yet confirmed can be cancelled'
        : 'This order can no longer be cancelled',
      409
    );
  }

  return order;
};

export const updateOrderStatus = async (
  orderId: string,
  user: RequestUser,
  status: 'CONFIRMED' | 'COMPLETED'
) => {
  const { order, access } = await loadOrderFor(orderId, user);

  if (access !== 'FARMER') {
    throw new AppError('Only the farmer can update this order', 403);
  }

  const result = await moveOrderStatus(orderId, STATUS_TRANSITIONS[status], status);
  if (result.count !== 1) {
    throw new AppError(`Order can't move from ${order.status} to ${status}`, 409);
  }

  return findOrderById(orderId);
};
