import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PoolClient } from 'pg';
import { Metrics, metrics } from '../src/metrics/registry.js';
import { instrumentClient } from '../src/database/query-timing.js';
test('metrics keep counters and cumulative fixed histogram buckets without retaining samples', () => {
  const m = new Metrics();
  m.increment('cache_hit_total');
  m.increment('cache_hit_total', 2);
  m.observe('request', 5);
  m.observe('request', 20);
  assert.equal(m.snapshot().counters.cache_hit_total, 3);
  const h = m.snapshot().histograms.request!;
  assert.equal(h.count, 2);
  assert.equal(h.sumMs, 25);
  assert.equal(h.buckets['5'], 1);
  assert.equal(h.buckets['25'], 2);
});
test('database instrumentation measures success/failure and callbacks without logging SQL or values', async () => {
  const client = {
    query(sql: string, ...args: unknown[]) {
      const callback = args.at(-1);
      if (typeof callback === 'function') {
        callback(null, { rows: [] });
        return;
      }
      return sql.includes('failure')
        ? Promise.reject(new Error('failure'))
        : Promise.resolve({ rows: [] });
    },
  } as unknown as PoolClient;
  instrumentClient(client);
  const before =
    metrics.snapshot().histograms['database_query_duration_ms:SELECT']?.count ??
    0;
  await client.query('SELECT $1', ['secret']);
  await assert.rejects(client.query('SELECT failure'));
  await new Promise<void>((resolve, reject) => {
    client.query('SELECT $1', ['secret'], (error) =>
      error ? reject(error) : resolve(),
    );
  });
  assert.equal(
    metrics.snapshot().histograms['database_query_duration_ms:SELECT']?.count,
    before + 3,
  );
  assert.ok(!JSON.stringify(metrics.snapshot()).includes('secret'));
});
