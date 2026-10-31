import pino from 'pino';
import supertest from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { LOG_REDACTION } from '../src/config/logger.js';
import { api, bearer, createUser, prisma, resetDatabase } from './helpers.js';

describe('suspended accounts', () => {
  beforeEach(resetDatabase);

  it('blocks a still-valid access token on the very next request', async () => {
    const { user, token } = await createUser();
    await api.get('/cart').set(bearer(token)).expect(200);

    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    await api.get('/cart').set(bearer(token)).expect(401);
  });

  it('blocks a token whose user no longer exists', async () => {
    const { user, token } = await createUser();
    await prisma.user.delete({ where: { id: user.id } });

    await api.get('/cart').set(bearer(token)).expect(401);
  });
});

describe('CORS', () => {
  const preflight = (origin: string) =>
    supertest(app)
      .options('/api/v1/categories')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'GET');

  it('allows the admin web app origin', async () => {
    const response = await preflight('http://localhost:5173');
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('gives no allow header to any other origin', async () => {
    const response = await preflight('https://evil.example');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('rate limits', () => {
  it('stops repeated admin login attempts', async () => {
    const attempt = () =>
      api.post('/auth/admin/login').send({ email: 'x@example.com', password: 'wrong-password' });

    for (let i = 0; i < 10; i += 1) await attempt();

    await attempt().expect(429);
  });
});

describe('logging', () => {
  it('redacts the admin registration secret', () => {
    const lines: string[] = [];
    const logger = pino(
      { redact: LOG_REDACTION },
      { write: (line: string) => lines.push(line) }
    );

    logger.info({ req: { headers: { 'x-admin-registration-secret': 'do-not-log' } } }, 'request');

    expect(lines.join('')).toContain('request');
    expect(lines.join('')).not.toContain('do-not-log');
  });
});
