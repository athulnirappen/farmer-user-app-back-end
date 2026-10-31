import { UserRole } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  bearer,
  createCategory,
  createFarmer,
  createProduct,
  createUser,
  prisma,
  resetDatabase,
} from './helpers.js';

const pickup = { fulfilmentType: 'PICKUP', timeSlot: '07-09' };

const placeOrder = async (token: string, productId: string, quantity = 2) => {
  const response = await api
    .post('/orders')
    .set(bearer(token))
    .send({ ...pickup, items: [{ productId, quantity }] })
    .expect(201);
  return response.body.data;
};

const firstOrder = (result: { orders: { id: string }[] }) => result.orders[0];

const stockOf = async (productId: string) =>
  (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock;

describe('checkout', () => {
  beforeEach(resetDatabase);

  it('splits one checkout into one order per farm and takes stock', async () => {
    const buyer = await createUser();
    const farmA = await createFarmer();
    const farmB = await createFarmer();
    const category = await createCategory();
    const tomato = await createProduct(farmA.farm.id, category.id, { price: 40, stock: 10 });
    const onion = await createProduct(farmB.farm.id, category.id, { price: 25, stock: 10 });

    await api
      .post('/orders')
      .set(bearer(buyer.token))
      .send({
        ...pickup,
        items: [
          { productId: tomato.id, quantity: 2 },
          { productId: onion.id, quantity: 4 },
        ],
      })
      .expect(201);

    const orders = await prisma.order.findMany({ orderBy: { totalAmount: 'asc' } });
    expect(orders).toHaveLength(2);
    expect(orders[0].orderGroupId).toBe(orders[1].orderGroupId);
    expect(orders.map((order) => order.totalAmount.toString())).toEqual(['80', '100']);
    expect(await stockOf(tomato.id)).toBe(8);
    expect(await stockOf(onion.id)).toBe(6);
  });

  it('refuses more than is in stock and leaves stock alone', async () => {
    const buyer = await createUser();
    const farmer = await createFarmer();
    const category = await createCategory();
    const product = await createProduct(farmer.farm.id, category.id, { stock: 1 });

    await api
      .post('/orders')
      .set(bearer(buyer.token))
      .send({ ...pickup, items: [{ productId: product.id, quantity: 2 }] })
      .expect(409);

    expect(await stockOf(product.id)).toBe(1);
    expect(await prisma.order.count()).toBe(0);
  });

  it('checks out from the cart and empties it', async () => {
    const buyer = await createUser();
    const farmer = await createFarmer();
    const category = await createCategory();
    const product = await createProduct(farmer.farm.id, category.id);

    await api
      .post('/cart/items')
      .set(bearer(buyer.token))
      .send({ productId: product.id, quantity: 1 })
      .expect(200);

    await api.post('/orders/from-cart').set(bearer(buyer.token)).send(pickup).expect(201);

    expect(await prisma.cartItem.count()).toBe(0);
  });

  it('stops a cart checkout when the price has changed', async () => {
    const buyer = await createUser();
    const farmer = await createFarmer();
    const category = await createCategory();
    const product = await createProduct(farmer.farm.id, category.id, { price: 40 });

    await api
      .post('/cart/items')
      .set(bearer(buyer.token))
      .send({ productId: product.id, quantity: 1 })
      .expect(200);
    await prisma.product.update({ where: { id: product.id }, data: { price: 55 } });

    await api.post('/orders/from-cart').set(bearer(buyer.token)).send(pickup).expect(409);
    expect(await prisma.order.count()).toBe(0);
  });
});

describe('cancelling and fulfilling', () => {
  beforeEach(resetDatabase);

  const setup = async () => {
    const buyer = await createUser();
    const farmer = await createFarmer();
    const category = await createCategory();
    const product = await createProduct(farmer.farm.id, category.id, { stock: 10 });
    const order = firstOrder(await placeOrder(buyer.token, product.id));
    return { buyer, farmer, product, order };
  };

  it('lets the buyer cancel a PLACED order and puts the stock back', async () => {
    const { buyer, product, order } = await setup();

    await api.post(`/orders/${order.id}/cancel`).set(bearer(buyer.token)).expect(200);

    expect(await stockOf(product.id)).toBe(10);
  });

  it('stops the buyer cancelling once confirmed, but lets the farmer', async () => {
    const { buyer, farmer, product, order } = await setup();

    await api
      .patch(`/orders/${order.id}/status`)
      .set(bearer(farmer.token))
      .send({ status: 'CONFIRMED' })
      .expect(200);

    await api.post(`/orders/${order.id}/cancel`).set(bearer(buyer.token)).expect(409);
    await api.post(`/orders/${order.id}/cancel`).set(bearer(farmer.token)).expect(200);

    expect(await stockOf(product.id)).toBe(10);
  });

  it('moves status only in order, and never past COMPLETED', async () => {
    const { farmer, order } = await setup();
    const move = (status: string) =>
      api.patch(`/orders/${order.id}/status`).set(bearer(farmer.token)).send({ status });

    await move('COMPLETED').expect(409);
    await move('CONFIRMED').expect(200);
    await move('COMPLETED').expect(200);
    await api.post(`/orders/${order.id}/cancel`).set(bearer(farmer.token)).expect(409);
  });

  it('hides an order from people who are not part of it', async () => {
    const { order } = await setup();
    const stranger = await createUser();
    const otherFarmer = await createFarmer();

    await api.get(`/orders/${order.id}`).set(bearer(stranger.token)).expect(404);
    await api.get(`/orders/${order.id}`).set(bearer(otherFarmer.token)).expect(404);
  });

  it('lets an admin read any order', async () => {
    const { order } = await setup();
    const admin = await createUser(UserRole.ADMIN);

    await api.get(`/orders/${order.id}`).set(bearer(admin.token)).expect(200);
  });
});
