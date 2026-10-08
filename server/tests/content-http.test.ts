import {
  testAuthentication,
  authenticatedAgent,
} from './auth-http-fixtures.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config/env.js';
import { contentFixture, input, id } from './content-fixtures.js';
const config = readConfig({
  NODE_ENV: 'test',
  CLIENT_ORIGIN: 'http://localhost:5173',
});
test('admin HTTP lifecycle and public visibility preserve response semantics', async () => {
  const { service } = contentFixture();
  const app = createApp(
    config,
    undefined,
    service,
    undefined,
    undefined,
    testAuthentication(),
  );
  const created = await authenticatedAgent(app)
    .post('/api/v1/admin/content')
    .send(input);
  assert.equal(created.status, 201);
  assert.equal(created.headers.location, `/api/v1/admin/content/${id}`);
  assert.equal(
    (await authenticatedAgent(app).get(`/api/v1/content/${input.slug}`)).status,
    404,
  );
  assert.equal(
    (await authenticatedAgent(app).get('/api/v1/content')).body.data.length,
    0,
  );
  assert.equal(
    (
      await authenticatedAgent(app)
        .patch(`/api/v1/admin/content/${id}`)
        .send({ title: 'Updated' })
    ).status,
    200,
  );
  assert.equal(
    (await authenticatedAgent(app).get(`/api/v1/admin/content/${id}`)).body.data
      .title,
    'Updated',
  );
  assert.equal(
    (await authenticatedAgent(app).post(`/api/v1/admin/content/${id}/publish`))
      .status,
    200,
  );
  assert.equal(
    (await authenticatedAgent(app).post(`/api/v1/admin/content/${id}/publish`))
      .status,
    200,
  );
  assert.equal(
    (await authenticatedAgent(app).get(`/api/v1/content/${input.slug}`)).status,
    200,
  );
  assert.equal(
    (await authenticatedAgent(app).get('/api/v1/content')).body.data.length,
    1,
  );
  assert.equal(
    (await authenticatedAgent(app).post(`/api/v1/admin/content/${id}/archive`))
      .status,
    200,
  );
  assert.equal(
    (await authenticatedAgent(app).get(`/api/v1/content/${input.slug}`)).status,
    404,
  );
  assert.equal(
    (await authenticatedAgent(app).get('/api/v1/content')).body.data.length,
    0,
  );
  assert.equal(
    (await authenticatedAgent(app).post(`/api/v1/admin/content/${id}/publish`))
      .status,
    409,
  );
  assert.equal(
    (await authenticatedAgent(app).delete(`/api/v1/admin/content/${id}`))
      .status,
    204,
  );
  assert.equal(
    (await authenticatedAgent(app).get(`/api/v1/admin/content/${id}`)).status,
    404,
  );
});
test('invalid HTTP input returns safe consistent errors', async () => {
  const { service } = contentFixture();
  const app = createApp(
    config,
    undefined,
    service,
    undefined,
    undefined,
    testAuthentication(),
  );
  for (const path of [
    '/api/v1/admin/content/not-a-uuid',
    '/api/v1/admin/content?status=ACTIVE',
    '/api/v1/content?status=DRAFT',
    '/api/v1/content?page=0',
  ]) {
    const response = await authenticatedAgent(app).get(path);
    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
    assert.equal(response.body.error.issues, undefined);
  }
});
test('health separates liveness from PostgreSQL readiness', async () => {
  let checks = 0;
  let unavailable = false;
  const app = createApp(config, undefined, undefined, async () => {
    checks++;
    if (unavailable) throw new Error('private dependency details');
  });
  assert.equal(
    (await authenticatedAgent(app).get('/api/v1/health/live')).status,
    200,
  );
  assert.equal(checks, 0);
  assert.equal(
    (await authenticatedAgent(app).get('/api/v1/health/ready')).status,
    200,
  );
  assert.equal(checks, 1);
  unavailable = true;
  const failed = await authenticatedAgent(app).get('/api/v1/health/ready');
  assert.equal(failed.status, 503);
  assert.equal(failed.body.error.code, 'NOT_READY');
  assert.equal(
    JSON.stringify(failed.body).includes('private dependency details'),
    false,
  );
  assert.equal(
    (await authenticatedAgent(createApp(config)).get('/api/v1/health/ready'))
      .status,
    503,
  );
  assert.equal(
    (await authenticatedAgent(app).get('/api/v1/health/live')).status,
    200,
  );
});
