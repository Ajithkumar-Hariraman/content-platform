import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config/env.js';
import { fixtures } from './fixtures.js';
import { authFixture, password } from './auth-fixtures.js';
import {
  csrfToken,
  sessionToken,
  testAuthentication,
} from './auth-http-fixtures.js';
const config = readConfig({
  NODE_ENV: 'test',
  CLIENT_ORIGIN: 'http://localhost:5173',
});
test('public reads remain accessible while admin routes and legacy product writes are protected', async () => {
  const { catalog } = fixtures();
  const app = createApp(
    config,
    catalog,
    undefined,
    undefined,
    undefined,
    testAuthentication(),
  );
  assert.equal((await request(app).get('/api/v1/products')).status, 200);
  assert.equal((await request(app).get('/api/v1/health/live')).status, 200);
  assert.equal((await request(app).get('/api/v1/admin/products')).status, 401);
  assert.equal(
    (await request(app).post('/api/v1/products').send({})).status,
    401,
  );
  assert.equal(
    (
      await request(app)
        .post('/api/v1/products')
        .set('Cookie', `cloudops_session=${sessionToken}`)
        .send({})
    ).status,
    403,
  );
  assert.equal(
    (
      await request(app)
        .get('/api/v1/admin/products')
        .set('Cookie', `cloudops_session=${sessionToken}`)
    ).status,
    200,
  );
  assert.equal(
    (
      await request(app)
        .post('/api/v1/products')
        .set('Cookie', `cloudops_session=${sessionToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({})
    ).status,
    400,
  );
});
test('login sets cookies; me returns CSRF; logout requires CSRF and invalidates server session', async () => {
  const fixture = await authFixture();
  const app = createApp(
    config,
    undefined,
    undefined,
    undefined,
    undefined,
    fixture.service,
  );
  const agent = request.agent(app);
  const login = await agent
    .post('/api/v1/auth/login')
    .set('Origin', config.clientOrigin)
    .send({ email: fixture.user().email, password });
  assert.equal(login.status, 200);
  assert.equal('token' in login.body, false);
  assert.ok(String(login.headers['set-cookie']).includes('HttpOnly'));
  const me = await agent.get('/api/v1/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.csrfToken, login.body.csrfToken);
  assert.equal((await agent.post('/api/v1/auth/logout')).status, 403);
  assert.equal(
    (
      await agent
        .post('/api/v1/auth/logout')
        .set('X-CSRF-Token', me.body.csrfToken)
    ).status,
    204,
  );
  assert.equal((await agent.get('/api/v1/auth/me')).status, 401);
});
test('security headers and authentication rate limiting use safe error responses', async () => {
  const fixture = await authFixture();
  fixture.repository.findCredentials = async () => null;
  const app = createApp(
    config,
    undefined,
    undefined,
    undefined,
    undefined,
    fixture.service,
  );
  const health = await request(app).get('/api/v1/health/live');
  assert.equal(health.headers['x-powered-by'], undefined);
  assert.equal(health.headers['x-content-type-options'], 'nosniff');
  for (let index = 0; index < 10; index++)
    await request(app).post('/api/v1/auth/login').send({});
  const limited = await request(app).post('/api/v1/auth/login').send({});
  assert.equal(limited.status, 429);
  assert.equal(limited.body.error.code, 'RATE_LIMITED');
});
test('production documentation is disabled unless explicitly configured', async () => {
  const prod = { ...config, nodeEnv: 'production' as const };
  assert.equal((await request(createApp(prod)).get('/api/docs')).status, 404);
  assert.equal(
    (await request(createApp(config)).get('/api/docs/openapi.json')).status,
    200,
  );
});
test('performance diagnostics deny anonymous and non-admin access and expose only safe administrator data', async () => {
  const fixture = await authFixture();
  const app = createApp(
    config,
    undefined,
    undefined,
    undefined,
    undefined,
    fixture.service,
  );
  const path = '/api/v1/admin/diagnostics/performance';
  assert.equal((await request(app).get(path)).status, 401);
  for (const role of ['VIEWER', 'EDITOR', 'ADMIN'] as const) {
    fixture.setUser({ role });
    const agent = request.agent(app);
    assert.equal(
      (
        await agent
          .post('/api/v1/auth/login')
          .send({ email: fixture.user().email, password })
      ).status,
      200,
    );
    const response = await agent.get(path);
    assert.equal(response.status, role === 'ADMIN' ? 200 : 403);
    if (role === 'ADMIN') {
      assert.equal(response.headers['cache-control'], 'no-store');
      assert.ok(response.body.metrics.histograms);
      assert.ok(response.body.process.memory);
      assert.equal(
        JSON.stringify(response.body).includes('DATABASE_URL'),
        false,
      );
    }
  }
});
