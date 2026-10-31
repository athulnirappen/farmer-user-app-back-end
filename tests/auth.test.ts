import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, bearer, createUser, prisma, resetDatabase } from './helpers.js';

const smsMock = vi.hoisted(() => ({ sentCodes: new Map<string, string>() }));

vi.mock('../src/shared/sms/sms.service.js', () => ({
  sendOtpSms: async (phone: string, code: string) => {
    smsMock.sentCodes.set(phone, code);
  },
}));

const phone = '+919900000001';

const registerBuyer = async () => {
  await api
    .post('/auth/user/register/request-otp')
    .send({ phone, name: 'Asha Buyer', email: 'asha@example.com' })
    .expect(200);

  const response = await api
    .post('/auth/user/register/verify-otp')
    .send({ phone, code: smsMock.sentCodes.get(phone) })
    .expect(201);

  return response.body.data;
};

describe('buyer OTP auth', () => {
  beforeEach(async () => {
    smsMock.sentCodes.clear();
    await resetDatabase();
  });

  it('registers a new buyer and returns a working session', async () => {
    const session = await registerBuyer();

    expect(session.user.phone).toBe(phone);
    expect(session.user.passwordHash).toBeUndefined();

    await api.get('/cart').set(bearer(session.accessToken)).expect(200);
  });

  it('rejects a wrong code', async () => {
    await api
      .post('/auth/user/register/request-otp')
      .send({ phone, name: 'Asha Buyer', email: 'asha@example.com' })
      .expect(200);

    const correct = smsMock.sentCodes.get(phone)!;
    const wrong = correct === '000000' ? '000001' : '000000';

    await api.post('/auth/user/register/verify-otp').send({ phone, code: wrong }).expect(401);
    expect(await prisma.user.count()).toBe(0);
  });

  it('sends an existing buyer through login', async () => {
    await registerBuyer();
    smsMock.sentCodes.clear();
    await prisma.otpChallenge.deleteMany();

    const start = await api.post('/auth/user/start').send({ phone }).expect(200);
    expect(start.body.data.nextStep).toBe('VERIFY_LOGIN');

    await api
      .post('/auth/user/login/verify-otp')
      .send({ phone, code: smsMock.sentCodes.get(phone) })
      .expect(200);
  });
});

describe('sessions', () => {
  beforeEach(resetDatabase);

  it('rotates refresh tokens and revokes all of them when an old one is reused', async () => {
    const session = await registerBuyer();

    const refreshed = await api
      .post('/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(200);

    await api.post('/auth/refresh').send({ refreshToken: session.refreshToken }).expect(401);
    await api
      .post('/auth/refresh')
      .send({ refreshToken: refreshed.body.data.refreshToken })
      .expect(401);
  });

  it('rejects requests with no token or a bad token', async () => {
    await api.get('/cart').expect(401);
    await api.get('/cart').set(bearer('not-a-token')).expect(401);
  });
});

describe('admin auth', () => {
  beforeEach(resetDatabase);

  const admin = { name: 'Site Admin', email: 'admin@example.com', password: 'correct-horse' };

  it('needs the registration secret, then logs in with the password', async () => {
    await api.post('/auth/admin/register').send(admin).expect(401);

    await api
      .post('/auth/admin/register')
      .set('x-admin-registration-secret', process.env.ADMIN_REGISTRATION_SECRET!)
      .send(admin)
      .expect(201);

    await api
      .post('/auth/admin/login')
      .send({ email: admin.email, password: 'wrong-password' })
      .expect(401);

    await api
      .post('/auth/admin/login')
      .send({ email: admin.email, password: admin.password })
      .expect(200);
  });

  it('keeps admin routes away from a USER token', async () => {
    const { token } = await createUser();
    await api.get('/orders/admin').set(bearer(token)).expect(403);
  });
});
