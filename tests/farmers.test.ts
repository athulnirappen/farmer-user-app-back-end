import { UserRole, VerificationStatus } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { PRODUCT_DECLARATION } from '../src/modules/products/product.declaration.js';
import { api, bearer, createCategory, createFarmer, createUser, resetDatabase } from './helpers.js';

describe('farmer approval', () => {
  beforeEach(resetDatabase);

  const productBody = (categoryId: string) => ({
    name: 'Fresh Spinach',
    price: 30,
    stock: 5,
    unit: 'bunch',
    categoryId,
    acceptDeclaration: true,
    declarationVersion: PRODUCT_DECLARATION.version,
  });

  it('takes a buyer from application to selling after admin approval', async () => {
    const { token } = await createUser();
    const admin = await createUser(UserRole.ADMIN);
    const category = await createCategory();

    const application = await api
      .post('/farmers/applications')
      .set(bearer(token))
      .send({ farmName: 'Green Acres', farmLocation: 'Thrissur', latitude: 10.5, longitude: 76.2 })
      .expect(201);

    await api.post('/products').set(bearer(token)).send(productBody(category.id)).expect(403);

    const pending = await api
      .get('/farmers/admin/applications/pending')
      .set(bearer(admin.token))
      .expect(200);
    expect(pending.body.data).toHaveLength(1);

    await api
      .patch(`/farmers/admin/applications/${application.body.data.id}`)
      .set(bearer(admin.token))
      .send({ status: 'APPROVED' })
      .expect(200);

    await api.post('/products').set(bearer(token)).send(productBody(category.id)).expect(201);
  });

  it('keeps a rejected farmer from selling', async () => {
    const { token } = await createFarmer(VerificationStatus.REJECTED);
    const category = await createCategory();

    await api.post('/products').set(bearer(token)).send(productBody(category.id)).expect(403);
  });

  it('requires the declaration to list a product', async () => {
    const { token } = await createFarmer();
    const category = await createCategory();

    await api
      .post('/products')
      .set(bearer(token))
      .send({ ...productBody(category.id), acceptDeclaration: false })
      .expect(400);
  });

  it('does not let one farmer edit another farmer\'s product', async () => {
    const owner = await createFarmer();
    const other = await createFarmer();
    const category = await createCategory();

    const product = await api
      .post('/products')
      .set(bearer(owner.token))
      .send(productBody(category.id))
      .expect(201);

    await api
      .patch(`/products/${product.body.data.id}`)
      .set(bearer(other.token))
      .send({
        stock: 0,
        acceptDeclaration: true,
        declarationVersion: PRODUCT_DECLARATION.version,
      })
      .expect(404);
  });
});
