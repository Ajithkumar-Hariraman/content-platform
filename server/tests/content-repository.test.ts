import { transactionPool } from './transaction-pool.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Pool } from 'pg';
import { ContentRepository } from '../src/repositories/content-repository.js';
import { PersistenceError } from '../src/repositories/persistence-error.js';
import { query, input } from './content-fixtures.js';
test('public list and slug lookup enforce visibility in parameterized SQL', async () => {
  const calls: { sql: string; values: unknown[] }[] = [];
  const pool = {
    async query(sql: string, values: unknown[]) {
      calls.push({ sql, values });
      return {
        rows: sql.includes('WITH filtered') ? [{ total: '0', items: [] }] : [],
      };
    },
  } as unknown as Pool;
  const repository = new ContentRepository(transactionPool(pool));
  const hostile = "%' OR 1=1 --";
  await repository.findPublicList({
    ...query,
    search: hostile,
    status: 'DRAFT',
  });
  await repository.findPublishedBySlug(hostile);
  assert.match(calls[0]!.sql, /status = 'PUBLISHED'/);
  assert.equal(calls[0]!.sql.includes(hostile), false);
  assert.equal(calls[0]!.values.includes('DRAFT'), false);
  assert.match(calls[0]!.sql, /ORDER BY published_at DESC NULLS LAST, id ASC/);
  assert.match(calls[1]!.sql, /status='PUBLISHED'/);
  assert.deepEqual(calls[1]!.values, [hostile]);
  for (const call of calls) assert.doesNotMatch(call.sql, /SELECT \*/);
});
test('publish guards lifecycle atomically and preserves original publication timestamp', async () => {
  const pool = {
    async query(sql: string, values: unknown[]) {
      if (sql.includes('FOR UPDATE'))
        return {
          rows: [
            {
              id: 'id',
              title: 'Draft',
              slug: 'draft',
              summary: null,
              body: 'Body',
              status: 'DRAFT',
              published_at: null,
              created_at: '2026-01-01',
              updated_at: '2026-01-01',
            },
          ],
        };
      assert.match(sql, /status IN \('DRAFT','PUBLISHED'\)/);
      assert.match(sql, /COALESCE\(published_at,clock_timestamp\(\)\)/);
      assert.deepEqual(values, ['id']);
      return { rows: [] };
    },
  } as unknown as Pool;
  assert.equal(
    await new ContentRepository(transactionPool(pool)).publish('id'),
    null,
  );
});
test('content unique slug violation maps to a persistence error', async () => {
  const pool = {
    async query() {
      throw { code: '23505', constraint: 'contents_slug_key' };
    },
  } as unknown as Pool;
  await assert.rejects(
    new ContentRepository(transactionPool(pool)).create(input),
    (error) =>
      error instanceof PersistenceError && error.kind === 'duplicate-slug',
  );
});
