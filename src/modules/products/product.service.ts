import { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors/app-error.js';
import { DEFAULT_RADIUS_KM, roundKm } from '../../shared/utils/geo.js';
import { getPagination } from '../../shared/utils/pagination.js';
import { removeImage, saveImage } from '../../shared/storage/storage.service.js';
import { findCategoryById } from '../categories/category.repository.js';
import { PRODUCT_DECLARATION } from './product.declaration.js';
import {
  addProductImage,
  countFarmerProducts,
  countNearbyVisibleProducts,
  countProductImages,
  countVisibleProducts,
  createProduct,
  deleteProductImage,
  findFarmerProducts,
  findNearbyVisibleProductIds,
  findOwnedProductById,
  findProductImage,
  findVisibleProductById,
  findVisibleProducts,
  findVisibleProductsByIds,
  updateOwnedProduct,
} from './product.repository.js';
import {
  CreateProductInput,
  ListProductsQuery,
  MyProductsQuery,
  UpdateProductInput,
} from './product.schemas.js';

const MAX_IMAGES_PER_PRODUCT = 5;

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
  const filter = { search: query.search, categoryId: query.categoryId, farmId: query.farmId };

  if (query.lat !== undefined && query.lng !== undefined) {
    const nearby = {
      ...filter,
      lat: query.lat,
      lng: query.lng,
      radiusKm: query.radiusKm ?? DEFAULT_RADIUS_KM,
    };
    const [matches, total] = await Promise.all([
      findNearbyVisibleProductIds({ ...nearby, skip, take: limit }),
      countNearbyVisibleProducts(nearby),
    ]);
    const products = await findVisibleProductsByIds(matches.map((match) => match.id));
    const productsById = new Map(products.map((product) => [product.id, product]));
    // Keep the distance order from SQL; skip any product hidden between the two queries
    const items = matches.flatMap((match) => {
      const product = productsById.get(match.id);
      return product ? [{ ...product, distanceKm: roundKm(match.distanceKm) }] : [];
    });

    return { items, page, limit, total, radiusKm: nearby.radiusKm };
  }

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

export const listMyProducts = async (farmId: string, query: MyProductsQuery) => {
  const { page, limit, skip } = getPagination(query.page, query.limit);
  const [items, total] = await Promise.all([
    findFarmerProducts({ farmId, skip, take: limit }),
    countFarmerProducts(farmId),
  ]);

  return { items, page, limit, total };
};

export const addProduct = async (farmId: string, input: CreateProductInput) => {
  const { acceptDeclaration, declarationVersion, price, ...fields } = input;
  const declaration = acceptedDeclaration({ acceptDeclaration, declarationVersion });
  await ensureCategoryExists(fields.categoryId);

  return createProduct({ ...fields, price: toPrice(price), farmId, ...declaration });
};

export const editProduct = async (farmId: string, productId: string, input: UpdateProductInput) => {
  const { acceptDeclaration, declarationVersion, price, ...fields } = input;
  // Restocking or pausing a listing says nothing new about the product itself
  const { stock, isActive, ...describingFields } = fields;
  const describesProduct =
    price !== undefined || Object.values(describingFields).some((value) => value !== undefined);
  const declaration = describesProduct
    ? acceptedDeclaration({ acceptDeclaration, declarationVersion })
    : {};
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

const loadOwnedProduct = async (farmId: string, productId: string) => {
  const product = await findOwnedProductById(productId, farmId);

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  return product;
};

export const addImage = async (
  farmId: string,
  productId: string,
  file: Express.Multer.File | undefined
) => {
  await loadOwnedProduct(farmId, productId);

  if (!file) {
    throw new AppError('Attach an image in the "image" field', 400);
  }
  if ((await countProductImages(productId)) >= MAX_IMAGES_PER_PRODUCT) {
    throw new AppError(`A product can have up to ${MAX_IMAGES_PER_PRODUCT} images`, 400);
  }

  const saved = await saveImage(file.buffer);
  return addProductImage({ productId, ...saved });
};

export const removeProductImage = async (farmId: string, productId: string, imageId: string) => {
  await loadOwnedProduct(farmId, productId);
  const image = await findProductImage(imageId, productId);

  if (!image) {
    throw new AppError('Image not found', 404);
  }

  await deleteProductImage(image.id);
  await removeImage(image.key);
  return { message: 'Image deleted' };
};

export const deleteProduct = async (farmId: string, productId: string) => {
  const result = await updateOwnedProduct(productId, farmId, { deletedAt: new Date() });

  if (result.count !== 1) {
    throw new AppError('Product not found', 404);
  }

  return { message: 'Product deleted' };
};
