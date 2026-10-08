import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config/env.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { requestLogging } from '../src/middleware/request-logging.js';

const config = readConfig({
  NODE_ENV: 'test',
  CLIENT_ORIGIN: 'http://localhost:5173',
});

test('health responds with runtime identity and propagates request id', async () => {
  const response = await request(createApp(config))
    .get('/api/v1/health')
    .set('x-request-id', 'test-123');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    status: 'ok',
    service: 'cloudops-content-api',
  });
  assert.equal(response.headers['x-request-id'], 'test-123');
  assert.equal(response.headers['x-powered-by'], undefined);
});

test('unknown routes return a predictable 404 with a generated request id', async () => {
  const response = await request(createApp(config)).get('/missing');
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
  assert.equal(response.body.error.requestId, response.headers['x-request-id']);
  const requestId = response.headers['x-request-id'];
  assert.equal(typeof requestId, 'string');
  assert.match(String(requestId), /^[0-9a-f-]{36}$/);
});

test('unexpected errors are logged and do not expose internal details', async (context) => {
  const errorLog = context.mock.method(console, 'error', () => undefined);
  const app = express();
  app.use(requestLogging);
  app.get('/error', async () => {
    throw new Error('private database details');
  });
  app.use(errorHandler);
  const response = await request(app).get('/error');
  assert.equal(response.status, 500);
  assert.equal(response.body.error.code, 'INTERNAL_ERROR');
  assert.equal(response.body.error.message, 'Internal server error');
  assert.equal(
    JSON.stringify(response.body).includes('private database details'),
    false,
  );
  assert.equal(response.body.error.stack, undefined);
  assert.equal(errorLog.mock.callCount(), 1);
  const logged = JSON.parse(String(errorLog.mock.calls[0]?.arguments[0]));
  assert.equal(logged.event, 'request_error');
  assert.equal(logged.requestId, response.headers['x-request-id']);
});

test('invalid JSON and oversized payloads return safe client errors', async () => {
  const app = createApp(config);
  const invalid = await request(app)
    .post('/api/v1/health')
    .set('Content-Type', 'application/json')
    .send('{');
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, 'INVALID_JSON');
  const oversized = await request(app)
    .post('/api/v1/health')
    .send({ value: 'x'.repeat(110000) });
  assert.equal(oversized.status, 413);
  assert.equal(oversized.body.error.code, 'PAYLOAD_TOO_LARGE');
});

test('CORS allows the configured frontend origin', async () => {
  const response = await request(createApp(config))
    .get('/api/v1/health')
    .set('Origin', config.clientOrigin);
  assert.equal(
    response.headers['access-control-allow-origin'],
    config.clientOrigin,
  );
});
