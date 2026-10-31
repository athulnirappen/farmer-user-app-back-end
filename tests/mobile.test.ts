import { VerificationStatus } from '@prisma/client';
import supertest from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { PRODUCT_DECLARATION } from '../src/modules/products/product.declaration.js';
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

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32),
]);

describe('profile', () => {
  beforeEach(resetDatabase);

  it('reports NONE for someone who never applied', async () => {
    const { token } = await createUser();

    const response = await api.get('/users/me').set(bearer(token)).expect(200);

    expect(response.body.data.farmerStatus).toBe('NONE');
    expect(response.body.data.farmer).toBeNull();
    expect(response.body.data.passwordHash).toBeUndefined();
  });

  it.each(['PENDING', 'APPROVED', 'REJECTED'] as VerificationStatus[])(
    'reports %s for an applicant',
    async (status) => {
      const { token } = await createFarmer(status);

      const response = await api.get('/users/me').set(bearer(token)).expect(200);

      expect(response.body.data.farmerStatus).toBe(status);
    }
  );

  it('updates name and email, and refuses an email someone else has', async () => {
    const { user: other } = await createUser();
    await prisma.user.update({ where: { id: other.id }, data: { email: 'taken@example.com' } });
    const { token } = await createUser();

    const updated = await api
      .patch('/users/me')
      .set(bearer(token))
      .send({ name: 'New Name', email: 'NEW@example.com' })
      .expect(200);
    expect(updated.body.data.email).toBe('new@example.com');

    await api.patch('/users/me').set(bearer(token)).send({ email: 'taken@example.com' }).expect(409);
    await api.patch('/users/me').set(bearer(token)).send({}).expect(400);
    await api.get('/users/me').expect(401);
  });

  it('still reaches saved addresses under the same prefix', async () => {
    const { token } = await createUser();
    await api.get('/users/me/addresses').set(bearer(token)).expect(200);
  });
});

describe('browsing as a guest', () => {
  beforeEach(resetDatabase);

  it('shows products, a single product and nearby farms without signing in', async () => {
    const farmer = await createFarmer();
    const category = await createCategory();
    const product = await createProduct(farmer.farm.id, category.id);

    const list = await api.get('/products').expect(200);
    expect(list.body.data.total).toBe(1);

    await api.get(`/products/${product.id}`).expect(200);
    await api.get('/products?lat=10&lng=76&radiusKm=50').expect(200);

    const farms = await api.get('/farmers/nearby?lat=10&lng=76').expect(200);
    expect(farms.body.data.items).toHaveLength(1);
  });

  it('never exposes why a product was hidden, or the declaration, to guests', async () => {
    const farmer = await createFarmer();
    const category = await createCategory();
    const product = await createProduct(farmer.farm.id, category.id);

    const response = await api.get(`/products/${product.id}`).expect(200);
    expect(response.body.data).not.toHaveProperty('hiddenReason');

    await api.get('/products/declaration').expect(401);
  });

  it('keeps writes behind sign-in', async () => {
    const farmer = await createFarmer();
    const category = await createCategory();
    const product = await createProduct(farmer.farm.id, category.id);

    await api.post('/products').send({}).expect(401);
    await api.patch(`/products/${product.id}`).send({ stock: 1 }).expect(401);
    await api.delete(`/products/${product.id}`).expect(401);
    await api.post(`/products/${product.id}/images`).expect(401);
    await api.get('/products/mine').expect(401);
    await api.post('/farmers/applications').send({}).expect(401);
    await api.get('/farmers/applications/me').expect(401);
    await api.get('/farmers/admin/applications').expect(401);
  });
});

describe('farm page', () => {
  beforeEach(resetDatabase);

  it('shows an approved farm and filters products by it', async () => {
    const farmer = await createFarmer();
    const other = await createFarmer();
    const category = await createCategory();
    await createProduct(farmer.farm.id, category.id);
    await createProduct(other.farm.id, category.id);

    const farm = await api.get(`/farmers/${farmer.farm.id}`).expect(200);
    expect(farm.body.data.productCount).toBe(1);
    expect(farm.body.data).not.toHaveProperty('userId');

    const products = await api.get(`/products?farmId=${farmer.farm.id}`).expect(200);
    expect(products.body.data.total).toBe(1);
  });

  it('does not show a pending farm', async () => {
    const farmer = await createFarmer(VerificationStatus.PENDING);
    await api.get(`/farmers/${farmer.farm.id}`).expect(404);
  });
});

describe('product images', () => {
  beforeEach(resetDatabase);

  const setup = async () => {
    const farmer = await createFarmer();
    const category = await createCategory();
    const product = await createProduct(farmer.farm.id, category.id);
    return { farmer, product };
  };

  const upload = (token: string, productId: string, file: Buffer, filename = 'photo.png') =>
    api
      .post(`/products/${productId}/images`)
      .set(bearer(token))
      .attach('image', file, { filename, contentType: 'image/png' });

  it('stores an image, shows it on the product, serves it, then deletes it', async () => {
    const { farmer, product } = await setup();

    const added = await upload(farmer.token, product.id, png).expect(201);
    const { id, url } = added.body.data;

    const shown = await api.get(`/products/${product.id}`).expect(200);
    expect(shown.body.data.images).toEqual([{ id, url }]);

    const file = await supertest(app).get(url).expect(200);
    expect(file.headers['content-type']).toContain('image/png');
    expect(file.headers['cross-origin-resource-policy']).toBe('cross-origin');

    await api.delete(`/products/${product.id}/images/${id}`).set(bearer(farmer.token)).expect(200);
    await supertest(app).get(url).expect(404);
  });

  it('rejects a file that only claims to be an image', async () => {
    const { farmer, product } = await setup();

    await upload(farmer.token, product.id, Buffer.from('<script>alert(1)</script>')).expect(400);
    expect(await prisma.productImage.count()).toBe(0);
  });

  it('ignores the uploaded file name', async () => {
    const { farmer, product } = await setup();

    const added = await upload(farmer.token, product.id, png, '../../evil.png').expect(201);

    expect(added.body.data.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
  });

  it('rejects oversized files and a sixth image', async () => {
    const { farmer, product } = await setup();

    await upload(farmer.token, product.id, Buffer.concat([png, Buffer.alloc(6 * 1024 * 1024)])).expect(400);

    for (let i = 0; i < 5; i += 1) await upload(farmer.token, product.id, png).expect(201);
    await upload(farmer.token, product.id, png).expect(400);
  });

  it("does not let a farmer change another farmer's images", async () => {
    const { product } = await setup();
    const other = await createFarmer();

    await upload(other.token, product.id, png).expect(404);
  });
});

describe('farmer lists and edits', () => {
  beforeEach(resetDatabase);

  it('paginates products and shows the farmer why one was hidden', async () => {
    const farmer = await createFarmer();
    const category = await createCategory();
    const first = await createProduct(farmer.farm.id, category.id);
    await createProduct(farmer.farm.id, category.id);
    await prisma.product.update({
      where: { id: first.id },
      data: { hiddenAt: new Date(), hiddenReason: 'Mislabelled' },
    });

    const page = await api.get('/products/mine?limit=1').set(bearer(farmer.token)).expect(200);
    expect(page.body.data.total).toBe(2);
    expect(page.body.data.items).toHaveLength(1);

    const all = await api.get('/products/mine').set(bearer(farmer.token)).expect(200);
    const hidden = all.body.data.items.find((item: { id: string }) => item.id === first.id);
    expect(hidden.hiddenReason).toBe('Mislabelled');
  });

  it('paginates orders', async () => {
    const farmer = await createFarmer();

    const response = await api.get('/orders/farmer').set(bearer(farmer.token)).expect(200);

    expect(response.body.data).toMatchObject({ items: [], total: 0, page: 1 });
  });

  it('lets a farmer restock or pause without the declaration, but not change details', async () => {
    const farmer = await createFarmer();
    const category = await createCategory();
    const product = await createProduct(farmer.farm.id, category.id);
    const edit = (body: object) =>
      api.patch(`/products/${product.id}`).set(bearer(farmer.token)).send(body);

    await edit({ stock: 25 }).expect(200);
    await edit({ isActive: false }).expect(200);
    await edit({ price: 50 }).expect(400);
    await edit({ name: 'Heirloom Tomato' }).expect(400);
    await edit({ stock: 30, description: 'New' }).expect(400);
    await edit({
      price: 50,
      acceptDeclaration: true,
      declarationVersion: PRODUCT_DECLARATION.version,
    }).expect(200);
  });
});

describe('applying and direct checkout', () => {
  beforeEach(resetDatabase);

  it('requires a map pin to apply as a farmer', async () => {
    const { token } = await createUser();

    await api
      .post('/farmers/applications')
      .set(bearer(token))
      .send({ farmName: 'No Pin Farm' })
      .expect(400);
  });

  it('stops a direct order when the price is not what the buyer saw', async () => {
    const buyer = await createUser();
    const farmer = await createFarmer();
    const category = await createCategory();
    const product = await createProduct(farmer.farm.id, category.id, { price: 40, stock: 5 });
    const order = (expectedPrice: number) =>
      api
        .post('/orders')
        .set(bearer(buyer.token))
        .send({
          fulfilmentType: 'PICKUP',
          timeSlot: '07-09',
          items: [{ productId: product.id, quantity: 1, expectedPrice }],
        });

    await order(35).expect(409);
    const saved = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(saved.stock).toBe(5);

    await order(40).expect(201);
  });
});
