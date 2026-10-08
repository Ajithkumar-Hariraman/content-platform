import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Request, Response, NextFunction } from 'express';
import { ActivityController } from '../src/controllers/activity-controller.js';
import { ActivityService } from '../src/services/activity-service.js';
import { AppError } from '../src/errors/app-error.js';
test('activity controller validates before reading DynamoDB and returns cursor page', async () => {
  let calls = 0;
  const service = new ActivityService({
    async findRecent(query) {
      calls++;
      assert.equal(query.limit, 20);
      return { data: [], nextCursor: null };
    },
  });
  const controller = new ActivityController(service);
  let body: unknown;
  const res = {
    json(data: unknown) {
      body = data;
    },
  } as Response;
  const next: NextFunction = () => {};
  await controller.findRecent({ query: {} } as Request, res, next);
  assert.deepEqual(body, { data: [], nextCursor: null });
  assert.equal(calls, 1);
  await assert.rejects(
    async () =>
      controller.findRecent(
        { query: { entityType: 'CONTENT' } } as unknown as Request,
        res,
        next,
      ),
    (error) => error instanceof AppError && error.statusCode === 400,
  );
  assert.equal(calls, 1);
});
test('activity dependency failure returns safe 503 and does not affect core readiness', async () => {
  const service = new ActivityService({
    async findRecent() {
      throw new Error('private AWS details');
    },
  });
  await assert.rejects(
    service.findRecent({ limit: 20 }),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 503 &&
      !error.message.includes('AWS'),
  );
});
