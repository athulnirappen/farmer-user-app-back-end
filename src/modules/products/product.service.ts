import { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors/app-error.js';
import { getPagination } from '../../shared/utils/pagination.js';
import { findCategoryById } from '../categories/category.repository.js';
import { PRODUCT_DECLARATION } from './product.declaration.js';
import {
  countVisibleProducts,
  createProduct,
  findFarmerProducts,
  findOwnedProductById,
  findVisibleProductById,
  findVisibleProducts,
  updateOwnedProduct,
} from './product.repository.js';
import { CreateProductInput, ListProductsQuery, UpdateProductInput } from './product.schemas.js';

export const getProductDeclaration = () => PRODUCT_DECLARATION;

const acceptedDeclaration = (input: { acceptDeclaration?: boolean; declarationVersion?: string }) => {
  if (input.acceptDeclaration !== true) {
    throw new AppError('You must accept the product declaration', 400);
  }
  if (input.declarationVersion !== PRODUCT_DECLARATION.version) {
    throw new AppError('The declaration has changed; please review and accept it again', 409);
  }

  return {
    declarationVersion: PRODUCT_DECLARATION.version,
    declarationAcceptedAt: new Date(),
  };
};

const ensureCategoryExists = async (categoryId: string) => {
  if (!(await findCategoryById(categoryId))) {
    throw new AppError('Category not found', 400);
  }
};

const toPrice = (price: number) => new Prisma.Decimal(price.toFixed(2));

export const listProducts = async (query: ListProductsQuery) => {
  const { page, limit, skip } = getPagination(query.page, query.limit);
  const filter = { search: query.search, categoryId: query.categoryId };
  const [items, total] = await Promise.all([
    findVisibleProducts({ ...filter, skip, take: limit }),
    countVisibleProducts(filter),
  ]);

  return { items, page, limit, total };
};

export const getProduct = async (productId: string) => {
  const product = await findVisibleProductById(productId);

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  return product;
};

export const listMyProducts = (farmId: string) => findFarmerProducts(farmId);

export const addProduct = async (farmId: string, input: CreateProductInput) => {
  const { acceptDeclaration, declarationVersion, price, ...fields } = input;
  const declaration = acceptedDeclaration({ acceptDeclaration, declarationVersion });
  await ensureCategoryExists(fields.categoryId);

  return createProduct({ ...fields, price: toPrice(price), farmId, ...declaration });
};

export const editProduct = async (farmId: string, productId: string, input: UpdateProductInput) => {
  const { acceptDeclaration, declarationVersion, price, ...fields } = input;
  const declaration = acceptedDeclaration({ acceptDeclaration, declarationVersion });
  if (fields.categoryId) {
    await ensureCategoryExists(fields.categoryId);
  }

  const result = await updateOwnedProduct(productId, farmId, {
    ...fields,
    ...(price !== undefined && { price: toPrice(price) }),
    ...declaration,
  });

  if (result.count !== 1) {
    throw new AppError('Product not found', 404);
  }

  return findOwnedProductById(productId, farmId);
};

export const deleteProduct = async (farmId: string, productId: string) => {
  const result = await updateOwnedProduct(productId, farmId, { deletedAt: new Date() });

  if (result.count !== 1) {
    throw new AppError('Product not found', 404);
  }

  return { message: 'Product deleted' };
};
