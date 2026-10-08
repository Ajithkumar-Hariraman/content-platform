import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Request, Response, NextFunction } from 'express';
import {
  getHealth,
  getReadiness,
} from '../src/controllers/health-controller.js';
import { AppError } from '../src/errors/app-error.js';
function response() {
  let body: unknown;
  const res = {
    locals: { requestId: 'health-test' },
    json(value: unknown) {
      body = value;
      return this;
    },
  } as unknown as Response;
  return { res, body: () => body };
}
const req = {} as Request;
const next: NextFunction = () => {
  throw new Error('Unexpected middleware continuation');
};
test('liveness succeeds without dependency access; readiness calls its dependency', async () => {
  const live = response();
  await getHealth(req, live.res, next);
  assert.deepEqual(live.body(), {
    status: 'ok',
    service: 'cloudops-content-api',
  });
  let checks = 0;
  const ready = response();
  await getReadiness(async () => {
    checks++;
  })(req, ready.res, next);
  assert.equal(checks, 1);
  assert.deepEqual(ready.body(), {
    status: 'ready',
    service: 'cloudops-content-api',
  });
});
test('readiness yields safe 503 for missing or failing dependency', async (context) => {
  context.mock.method(console, 'error', () => undefined);
  for (const dependency of [
    undefined,
    async () => {
      throw new Error('private credentials');
    },
  ]) {
    const ready = response();
    await assert.rejects(
      async () => getReadiness(dependency)(req, ready.res, next),
      (error) =>
        error instanceof AppError &&
        error.statusCode === 503 &&
        error.code === 'NOT_READY' &&
        !error.message.includes('credentials'),
    );
    assert.equal(ready.body(), undefined);
  }
});
