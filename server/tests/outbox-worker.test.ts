import { metrics } from '../src/metrics/registry.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Pool } from 'pg';
import { OutboxRepository } from '../src/repositories/outbox-repository.js';
import { OutboxWorker } from '../src/workers/outbox-worker.js';
import {
  activityEvent,
  type ActivityEvent,
} from '../src/events/activity-event.js';
import { id } from './content-fixtures.js';
function fixture(event: ActivityEvent) {
  let processed = false;
  let attempt = 0;
  let error: string | null = null;
  let delayed = false;
  const statements: string[] = [];
  const client = {
    async query(sql: string, values?: unknown[]) {
      statements.push(sql);
      if (sql.startsWith('SELECT'))
        return {
          rows:
            processed || delayed
              ? []
              : [{ id: event.id, payload: event, attempt_count: attempt }],
        };
      if (sql.startsWith('UPDATE')) {
        attempt++;
        if (sql.includes('processed_at=clock_timestamp()')) {
          processed = true;
          error = null;
        } else {
          error = String(values?.[1]);
          delayed = true;
          assert.ok(Number(values?.[2]) > 0);
        }
      }
      return { rows: [] };
    },
    release() {},
  };
  return {
    repository: new OutboxRepository({
      async connect() {
        return client;
      },
    } as unknown as Pool),
    processed: () => processed,
    attempt: () => attempt,
    error: () => error,
    retry: () => {
      delayed = false;
    },
    statements,
  };
}
test('worker success marks processed; transient failure stays pending and later retry succeeds', async (context) => {
  context.mock.method(console, 'log', () => undefined);
  context.mock.method(console, 'error', () => undefined);
  const before = metrics.snapshot().counters;
  const event = activityEvent('CONTENT_CREATED', 'CONTENT', id);
  const f = fixture(event);
  let available = false;
  const deliveries: ActivityEvent[] = [];
  const worker = new OutboxWorker(
    f.repository,
    {
      async put(data) {
        if (!available) throw new Error('secret must not be recorded');
        deliveries.push(data);
      },
    },
    10,
  );
  const signal = new AbortController().signal;
  assert.equal(await worker.runBatch(signal), 1);
  assert.equal(f.processed(), false);
  assert.equal(f.attempt(), 1);
  assert.equal(f.error(), 'Error');
  assert.match(
    f.statements.find((sql) => sql.startsWith('SELECT')) ?? '',
    /FOR UPDATE SKIP LOCKED/,
  );
  assert.equal(await worker.runBatch(signal), 0);
  available = true;
  f.retry();
  assert.equal(await worker.runBatch(signal), 1);
  assert.equal(f.processed(), true);
  assert.equal(f.attempt(), 2);
  assert.equal(f.error(), null);
  assert.deepEqual(deliveries, [event]);
  for (const key of [
    'outbox_processed_total',
    'outbox_failed_total',
    'outbox_retried_total',
  ])
    assert.equal(metrics.snapshot().counters[key], (before[key] ?? 0) + 1);
});
test('worker bounds batches and stops before acquiring another event on shutdown', async (context) => {
  context.mock.method(console, 'log', () => undefined);
  const controller = new AbortController();
  let calls = 0;
  const event = activityEvent('PRODUCT_DELETED', 'PRODUCT', id);
  const outbox = {
    async processNext(deliver: Parameters<OutboxRepository['processNext']>[0]) {
      calls++;
      await deliver({ id: event.id, attempt: 1, payload: event });
      return true;
    },
  };
  const worker = new OutboxWorker(outbox, { async put() {} }, 2);
  assert.equal(await worker.runBatch(controller.signal), 2);
  assert.equal(calls, 2);
  const stopping = new OutboxWorker(
    outbox,
    {
      async put() {
        controller.abort();
      },
    },
    10,
  );
  assert.equal(await stopping.runBatch(controller.signal), 1);
  assert.equal(calls, 3);
  assert.equal(await stopping.runBatch(controller.signal), 0);
});
test('invalid event identity remains pending with safe diagnostics', async (context) => {
  context.mock.method(console, 'error', () => undefined);
  let outcome: unknown;
  const event = activityEvent('CONTENT_CREATED', 'CONTENT', id);
  const worker = new OutboxWorker(
    {
      async processNext(deliver) {
        outcome = await deliver({ id, attempt: 1, payload: event });
        return true;
      },
    },
    {
      async put() {
        throw new Error('Must not deliver');
      },
    },
    1,
  );
  await worker.runBatch(new AbortController().signal);
  assert.deepEqual(outcome, { ok: false, error: 'Error' });
});

test('DynamoDB acceptance followed by PostgreSQL acknowledgement failure replays the same identity', async (context) => {
  context.mock.method(console, 'log', () => undefined);
  const event = activityEvent('CONTENT_CREATED', 'CONTENT', id);
  let acknowledged = false;
  let staged = false;
  let failAcknowledgement = true;
  let rollbacks = 0;
  const deliveries: string[] = [];
  const client = {
    async query(sql: string) {
      if (sql.startsWith('SELECT'))
        return {
          rows: acknowledged
            ? []
            : [{ id: event.id, payload: event, attempt_count: 0 }],
        };
      if (sql.startsWith('UPDATE')) {
        if (failAcknowledgement) {
          failAcknowledgement = false;
          throw new Error('PostgreSQL connection lost');
        }
        staged = true;
      }
      if (sql === 'COMMIT') acknowledged = staged;
      if (sql === 'ROLLBACK') {
        staged = false;
        rollbacks++;
      }
      return { rows: [] };
    },
    release() {},
  };
  const worker = new OutboxWorker(
    new OutboxRepository({
      async connect() {
        return client;
      },
    } as unknown as Pool),
    {
      async put(data) {
        deliveries.push(data.id);
      },
    },
    1,
  );
  await assert.rejects(worker.runBatch(new AbortController().signal));
  assert.equal(acknowledged, false);
  assert.equal(rollbacks, 1);
  await worker.runBatch(new AbortController().signal);
  assert.equal(acknowledged, true);
  assert.deepEqual(deliveries, [event.id, event.id]);
});
