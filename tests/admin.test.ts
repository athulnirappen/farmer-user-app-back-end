import { UserRole, VerificationStatus } from '@prisma/client';
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

const auditActions = async () =>
  (await prisma.adminAuditLog.findMany({ orderBy: { createdAt: 'asc' } })).map((row) => row.action);

describe('admin access', () => {
  beforeEach(resetDatabase);

  const adminRoutes = [
    '/admin/stats',
    '/admin/users',
    '/admin/products',
    '/admin/audit-log',
    '/farmers/admin/applications',
  ];

  it.each(adminRoutes)('%s rejects USER tokens and anonymous requests', async (path) => {
    const { token } = await createUser();

    await api.get(path).set(bearer(token)).expect(403);
    await api.get(path).expect(401);
  });
});

describe('managing users', () => {
  beforeEach(resetDatabase);

  it('searches users', async () => {
    const admin = await createUser(UserRole.ADMIN);
    const { user } = await createUser();
    await prisma.user.update({ where: { id: user.id }, data: { name: 'Findable Fatima' } });

    const response = await api
      .get('/admin/users?search=fatima')
      .set(bearer(admin.token))
      .expect(200);

    expect(response.body.data.total).toBe(1);
    expect(response.body.data.items[0].id).toBe(user.id);
    expect(response.body.data.items[0].passwordHash).toBeUndefined();
  });

  it('suspends a user, ends their sessions, and can reactivate them', async () => {
    const admin = await createUser(UserRole.ADMIN);
    const { user, token } = await createUser();
    await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: 'hash', expiresAt: new Date(Date.now() + 60_000) },
    });

    await api
      .patch(`/admin/users/${user.id}/status`)
      .set(bearer(admin.token))
      .send({ isActive: false, reason: 'Fraud report' })
      .expect(200);

    await api.get('/cart').set(bearer(token)).expect(401);
    const session = await prisma.refreshToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(session.revokedAt).not.toBeNull();

    await api
      .patch(`/admin/users/${user.id}/status`)
      .set(bearer(admin.token))
      .send({ isActive: true })
      .expect(200);

    await api.get('/cart').set(bearer(token)).expect(200);
    expect(await auditActions()).toEqual(['USER_SUSPENDED', 'USER_REACTIVATED']);
  });

  it('needs a reason to suspend, and refuses to suspend yourself', async () => {
    const admin = await createUser(UserRole.ADMIN);
    const { user } = await createUser();

    await api
      .patch(`/admin/users/${user.id}/status`)
      .set(bearer(admin.token))
      .send({ isActive: false })
      .expect(400);

    await api
      .patch(`/admin/users/${admin.user.id}/status`)
      .set(bearer(admin.token))
      .send({ isActive: false, reason: 'Oops' })
      .expect(400);
  });

  it("takes a suspended farmer's products off sale", async () => {
    const admin = await createUser(UserRole.ADMIN);
    const buyer = await createUser();
    const farmer = await createFarmer();
    const category = await createCategory();
    const product = await createProduct(farmer.farm.id, category.id);

    await api
      .patch(`/admin/users/${farmer.user.id}/status`)
      .set(bearer(admin.token))
      .send({ isActive: false, reason: 'Investigation' })
      .expect(200);

    const list = await api.get('/products').set(bearer(buyer.token)).expect(200);
    const near = await api
      .get('/products?lat=10&lng=76&radiusKm=50')
      .set(bearer(buyer.token))
      .expect(200);
    const farms = await api
      .get('/farmers/nearby?lat=10&lng=76')
      .set(bearer(buyer.token))
      .expect(200);

    expect(list.body.data.total).toBe(0);
    expect(near.body.data.total).toBe(0);
    expect(farms.body.data.items).toHaveLength(0);
    await api
      .post('/orders')
      .set(bearer(buyer.token))
      .send({
        fulfilmentType: 'PICKUP',
        timeSlot: '07-09',
        items: [{ productId: product.id, quantity: 1 }],
      })
      .expect(400);
  });
});

describe('reviewing farmers', () => {
  beforeEach(resetDatabase);

  it('lists applications by status, with pagination', async () => {
    const admin = await createUser(UserRole.ADMIN);
    await createFarmer(VerificationStatus.PENDING);
    await createFarmer(VerificationStatus.APPROVED);

    const response = await api
      .get('/farmers/admin/applications?status=APPROVED')
      .set(bearer(admin.token))
      .expect(200);

    expect(response.body.data.total).toBe(1);
    expect(response.body.data.items[0].verificationStatus).toBe('APPROVED');
  });

  it('needs a reason to reject, then shows it to the farmer', async () => {
    const admin = await createUser(UserRole.ADMIN);
    const farmer = await createFarmer(VerificationStatus.PENDING);
    const review = () =>
      api.patch(`/farmers/admin/applications/${farmer.farm.id}`).set(bearer(admin.token));

    await review().send({ status: 'REJECTED' }).expect(400);
    await review().send({ status: 'REJECTED', reason: 'Blurry documents' }).expect(200);

    const mine = await api.get('/farmers/applications/me').set(bearer(farmer.token)).expect(200);
    expect(mine.body.data.rejectionReason).toBe('Blurry documents');

    const saved = await prisma.farmerProfile.findUniqueOrThrow({ where: { id: farmer.farm.id } });
    expect(saved.reviewedById).toBe(admin.user.id);
    expect(await auditActions()).toEqual(['FARMER_REJECTED']);
  });

  it('revokes an approved farmer, and clears the reason when they reapply', async () => {
    const admin = await createUser(UserRole.ADMIN);
    const buyer = await createUser();
    const farmer = await createFarmer();
    const category = await createCategory();
    const product = await createProduct(farmer.farm.id, category.id);

    await api
      .patch(`/farmers/admin/applications/${farmer.farm.id}`)
      .set(bearer(admin.token))
      .send({ status: 'REJECTED', reason: 'Licence expired' })
      .expect(200);

    await api.get(`/products/${product.id}`).set(bearer(buyer.token)).expect(404);
    await api.get('/products/mine').set(bearer(farmer.token)).expect(403);

    const reapplied = await api
      .post('/farmers/applications')
      .set(bearer(farmer.token))
      .send({ farmName: 'Test Farm' })
      .expect(201);
    expect(reapplied.body.data.verificationStatus).toBe('PENDING');
    expect(reapplied.body.data.rejectionReason).toBeNull();
  });

  it("won't approve a rejected application without a new one", async () => {
    const admin = await createUser(UserRole.ADMIN);
    const farmer = await createFarmer(VerificationStatus.REJECTED);

    await api
      .patch(`/farmers/admin/applications/${farmer.farm.id}`)
      .set(bearer(admin.token))
      .send({ status: 'APPROVED' })
      .expect(409);
  });
});

describe('moderating products', () => {
  beforeEach(resetDatabase);

  it('hides a product from buyers, and the farmer cannot undo it', async () => {
    const admin = await createUser(UserRole.ADMIN);
    const buyer = await createUser();
    const farmer = await createFarmer();
    const category = await createCategory();
    const product = await createProduct(farmer.farm.id, category.id);
    const status = () =>
      api.patch(`/admin/products/${product.id}/status`).set(bearer(admin.token));

    await status().send({ hidden: true }).expect(400);
    await status().send({ hidden: true, reason: 'Mislabelled' }).expect(200);

    await api.get(`/products/${product.id}`).set(bearer(buyer.token)).expect(404);

    const hidden = await api.get('/admin/products?hidden=true').set(bearer(admin.token)).expect(200);
    expect(hidden.body.data.total).toBe(1);
    expect(hidden.body.data.items[0].hiddenReason).toBe('Mislabelled');

    await prisma.product.update({ where: { id: product.id }, data: { isActive: true } });
    await api.get(`/products/${product.id}`).set(bearer(buyer.token)).expect(404);

    await status().send({ hidden: false }).expect(200);
    await api.get(`/products/${product.id}`).set(bearer(buyer.token)).expect(200);
    expect(await auditActions()).toEqual(['PRODUCT_HIDDEN', 'PRODUCT_RESTORED']);
  });

  it('marks a hidden product as unavailable in carts', async () => {
    const admin = await createUser(UserRole.ADMIN);
    const buyer = await createUser();
    const farmer = await createFarmer();
    const category = await createCategory();
    const product = await createProduct(farmer.farm.id, category.id);

    await api
      .post('/cart/items')
      .set(bearer(buyer.token))
      .send({ productId: product.id, quantity: 1 })
      .expect(200);
    await api
      .patch(`/admin/products/${product.id}/status`)
      .set(bearer(admin.token))
      .send({ hidden: true, reason: 'Recall' })
      .expect(200);

    const cart = await api.get('/cart').set(bearer(buyer.token)).expect(200);
    expect(cart.body.data.items[0].issue).toBe('UNAVAILABLE');
  });
});

describe('admin orders', () => {
  beforeEach(resetDatabase);

  const placeOrder = async () => {
    const admin = await createUser(UserRole.ADMIN);
    const buyer = await createUser();
    const farmer = await createFarmer();
    const category = await createCategory();
    const product = await createProduct(farmer.farm.id, category.id, { stock: 5 });
    const placed = await api
      .post('/orders')
      .set(bearer(buyer.token))
      .send({
        fulfilmentType: 'PICKUP',
        timeSlot: '07-09',
        items: [{ productId: product.id, quantity: 2 }],
      })
      .expect(201);
    return { admin, buyer, farmer, product, order: placed.body.data.orders[0] };
  };

  it('cancels with a reason, restocks, and records it', async () => {
    const { admin, product, order } = await placeOrder();

    await api.post(`/orders/${order.id}/cancel`).set(bearer(admin.token)).expect(400);
    const cancelled = await api
      .post(`/orders/${order.id}/cancel`)
      .set(bearer(admin.token))
      .send({ reason: 'Farmer unreachable' })
      .expect(200);

    expect(cancelled.body.data.cancelledBy).toBe('ADMIN');
    const saved = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(saved.stock).toBe(5);
    expect(await auditActions()).toEqual(['ORDER_CANCELLED']);
  });

  it('shows buyer details to admins but not to farmers', async () => {
    const { admin, buyer, farmer, order } = await placeOrder();

    const list = await api
      .get(`/orders/admin?buyerId=${buyer.user.id}`)
      .set(bearer(admin.token))
      .expect(200);
    expect(list.body.data.items[0].buyer.id).toBe(buyer.user.id);

    const detail = await api.get(`/orders/${order.id}`).set(bearer(admin.token)).expect(200);
    expect(detail.body.data.buyer.id).toBe(buyer.user.id);

    const farmerView = await api.get(`/orders/${order.id}`).set(bearer(farmer.token)).expect(200);
    expect(farmerView.body.data.buyer).toBeUndefined();
  });
});

describe('stats and audit log', () => {
  beforeEach(resetDatabase);

  it('counts what the dashboard shows', async () => {
    const admin = await createUser(UserRole.ADMIN);
    await createFarmer(VerificationStatus.PENDING);
    const farmer = await createFarmer();
    const category = await createCategory();
    await createProduct(farmer.farm.id, category.id);

    const response = await api.get('/admin/stats').set(bearer(admin.token)).expect(200);

    expect(response.body.data).toMatchObject({
      buyers: 2,
      pendingFarmers: 1,
      approvedFarmers: 1,
      products: 1,
      orders: { PLACED: 0, CANCELLED: 0 },
    });
  });

  it('records category changes by admins, with who did them', async () => {
    const admin = await createUser(UserRole.ADMIN);

    const created = await api
      .post('/categories')
      .set(bearer(admin.token))
      .send({ name: 'Spices' })
      .expect(201);
    const categoryId = created.body.data.category.id;
    await api
      .patch(`/categories/${categoryId}`)
      .set(bearer(admin.token))
      .send({ name: 'Herbs' })
      .expect(200);
    await api.delete(`/categories/${categoryId}`).set(bearer(admin.token)).expect(200);

    const log = await api
      .get(`/admin/audit-log?targetType=CATEGORY&targetId=${categoryId}`)
      .set(bearer(admin.token))
      .expect(200);

    expect(log.body.data.total).toBe(3);
    expect(log.body.data.items[0].actor.id).toBe(admin.user.id);
  });
});
