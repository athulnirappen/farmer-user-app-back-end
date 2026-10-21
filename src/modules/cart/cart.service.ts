import { Prisma, VerificationStatus } from '@prisma/client';
import { AppError } from '../../shared/errors/app-error.js';
import {
  CartProduct,
  countCartItems,
  deleteAllCartItems,
  deleteCartItem,
  findCartItem,
  findCartItems,
  findProductForCart,
  saveCartItem,
} from './cart.repository.js';
import { AddCartItemInput, UpdateCartItemInput } from './cart.schemas.js';

// Same limits as checkout, so anything in the cart can be ordered in one go
const MAX_CART_PRODUCTS = 50;
const MAX_QUANTITY = 1000;

export type CartIssue = 'UNAVAILABLE' | 'INSUFFICIENT_STOCK' | 'PRICE_CHANGED';

// Same rule as visibleWhere in the products module
const isBuyable = (product: CartProduct) =>
  product.deletedAt === null &&
  product.isActive &&
  product.farmer.verificationStatus === VerificationStatus.APPROVED;

const loadBuyableProduct = async (buyerId: string, productId: string) => {
  const product = await findProductForCart(productId);

  if (!product || !isBuyable(product)) {
    throw new AppError('This product is not available', 400);
  }
  if (product.farmer.userId === buyerId) {
    throw new AppError(`You can't add your own product (${product.name}) to the cart`, 400);
  }

  return product;
};

const ensureInStock = (product: CartProduct, quantity: number) => {
  if (quantity > MAX_QUANTITY) {
    throw new AppError(`You can order at most ${MAX_QUANTITY} ${product.unit} of ${product.name}`, 400);
  }
  if (quantity > product.stock) {
    throw new AppError(`Only ${product.stock} ${product.unit} of ${product.name} left`, 409);
  }
};

const issueFor = (
  product: CartProduct,
  quantity: number,
  unitPriceAtAdd: Prisma.Decimal
): CartIssue | null => {
  if (!isBuyable(product)) return 'UNAVAILABLE';
  if (product.stock < quantity) return 'INSUFFICIENT_STOCK';
  if (!product.price.equals(unitPriceAtAdd)) return 'PRICE_CHANGED';
  return null;
};

export const getCart = async (buyerId: string) => {
  const rows = await findCartItems(buyerId);
  let subtotal = new Prisma.Decimal(0);

  const items = rows.map(({ product, quantity, unitPriceAtAdd, productId }) => {
    const issue = issueFor(product, quantity, unitPriceAtAdd);
    const lineTotal = product.price.mul(quantity);
    // Items that can't be bought at all don't count towards the total
    if (issue !== 'UNAVAILABLE') {
      subtotal = subtotal.add(lineTotal);
    }

    return {
      productId,
      quantity,
      unitPrice: product.price,
      unitPriceAtAdd,
      lineTotal,
      availableStock: product.stock,
      issue,
      product: {
        id: product.id,
        name: product.name,
        unit: product.unit,
        farmer: {
          id: product.farmer.id,
          farmName: product.farmer.farmName,
          farmLocation: product.farmer.farmLocation,
          latitude: product.farmer.latitude,
          longitude: product.farmer.longitude,
        },
      },
    };
  });

  return {
    items,
    itemCount: items.length,
    subtotal,
    hasIssues: items.some((item) => item.issue !== null),
  };
};

export const addToCart = async (buyerId: string, input: AddCartItemInput) => {
  const product = await loadBuyableProduct(buyerId, input.productId);
  const existing = await findCartItem(buyerId, input.productId);

  if (!existing && (await countCartItems(buyerId)) >= MAX_CART_PRODUCTS) {
    throw new AppError(`Your cart can hold up to ${MAX_CART_PRODUCTS} products`, 400);
  }

  const quantity = (existing?.quantity ?? 0) + input.quantity;
  ensureInStock(product, quantity);
  await saveCartItem({ buyerId, productId: product.id, quantity, unitPrice: product.price });

  return getCart(buyerId);
};

export const updateCartItem = async (
  buyerId: string,
  productId: string,
  input: UpdateCartItemInput
) => {
  if (!(await findCartItem(buyerId, productId))) {
    throw new AppError('This product is not in your cart', 404);
  }

  const product = await loadBuyableProduct(buyerId, productId);
  ensureInStock(product, input.quantity);
  await saveCartItem({ buyerId, productId, quantity: input.quantity, unitPrice: product.price });

  return getCart(buyerId);
};

export const removeCartItem = async (buyerId: string, productId: string) => {
  const result = await deleteCartItem(buyerId, productId);

  if (result.count === 0) {
    throw new AppError('This product is not in your cart', 404);
  }

  return getCart(buyerId);
};

export const clearCart = async (buyerId: string) => {
  await deleteAllCartItems(buyerId);
  return getCart(buyerId);
};
