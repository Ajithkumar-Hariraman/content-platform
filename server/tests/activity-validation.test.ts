import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseActivityQuery } from '../src/validation/activity.js';
import { readEventConfig } from '../src/config/events.js';
import { AppError } from '../src/errors/app-error.js';
import { id } from './content-fixtures.js';
test('activity query bounds limit, requires paired entity filters, and validates scoped cursors', () => {
  assert.deepEqual(parseActivityQuery({}), { limit: 20 });
  assert.deepEqual(
    parseActivityQuery({ entityType: 'CONTENT', entityId: id }),
    { limit: 20, entityType: 'CONTENT', entityId: id },
  );
  for (const query of [
    { limit: '0' },
    { limit: '101' },
    { limit: ['2'] },
    { entityType: 'USER' },
    { entityId: id },
    { entityType: 'CONTENT' },
    { entityType: 'CONTENT', entityId: 'bad' },
    { cursor: 'bad' },
    { extra: 'field' },
  ])
    assert.throws(
      () => parseActivityQuery(query),
      (error) => error instanceof AppError && error.statusCode === 400,
    );
  const key = {
    pk: `ENTITY#CONTENT#${id}`,
    sk: `2026-01-01T00:00:00.000Z#${id}`,
  };
  const cursor = Buffer.from(JSON.stringify(key)).toString('base64url');
  assert.equal(
    parseActivityQuery({ entityType: 'CONTENT', entityId: id, cursor }).cursor,
    cursor,
  );
  assert.throws(() =>
    parseActivityQuery({ entityType: 'PRODUCT', entityId: id, cursor }),
  );
  assert.throws(() => parseActivityQuery({ cursor }));
  const global = Buffer.from(
    JSON.stringify({ ...key, gsiPk: 'RECENT', gsiSk: key.sk }),
  ).toString('base64url');
  assert.equal(parseActivityQuery({ cursor: global }).cursor, global);
});
test('event configuration supports local dummy credentials and production provider-chain configuration', () => {
  assert.equal(readEventConfig({}).endpoint, undefined);
  assert.equal(
    readEventConfig({ DYNAMODB_ENDPOINT: 'http://127.0.0.1:58000' }).endpoint,
    'http://127.0.0.1:58000',
  );
  for (const env of [
    { OUTBOX_BATCH_SIZE: '0' },
    { OUTBOX_POLL_INTERVAL_MS: 'NaN' },
    { DYNAMODB_ACTIVITY_TABLE: 'x' },
    { DYNAMODB_ENDPOINT: 'http://secret:password@localhost:58000' },
    { NODE_ENV: 'production', DYNAMODB_ENDPOINT: 'http://localhost:58000' },
  ])
    assert.throws(() => readEventConfig(env));
});

test('event contracts normalize entity UUIDs and reject mismatched event types or secret fields', async () => {
  const { activityEvent, activityEventSchema } =
    await import('../src/events/activity-event.js');
  const event = activityEvent('CONTENT_CREATED', 'CONTENT', id.toUpperCase());
  assert.equal(event.entityId, id);
  assert.throws(() =>
    activityEventSchema.parse({ ...event, eventType: 'PRODUCT_CREATED' }),
  );
  assert.throws(() =>
    activityEventSchema.parse({ ...event, data: { password: 'secret' } }),
  );
  assert.equal(
    parseActivityQuery({ entityType: 'CONTENT', entityId: id.toUpperCase() })
      .entityId,
    id,
  );
});
