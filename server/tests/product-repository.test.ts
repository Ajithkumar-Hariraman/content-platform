import { transactionPool } from './transaction-pool.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Pool } from 'pg';
import { ProductRepository } from '../src/repositories/product-repository.js';
import {
  PersistenceError,
  rethrowDatabaseError,
} from '../src/repositories/persistence-error.js';
import { input } from './fixtures.js';

test('repository parameterizes hostile search strings and numeric price ordering', async () => {
  let sql = '';
  let parameters: unknown[] = [];
  const pool = {
    async query(text: string, values: unknown[]) {
      sql = text;
      parameters = values;
      return { rows: [{ total: '12', items: [] }] };
    },
  } as unknown as Pool;
  const repository = new ProductRepository(transactionPool(pool));
  const search = "phone%' OR 1=1 --";
  const result = await repository.findAll({
    page: 4,
    limit: 10,
    search,
    status: 'ACTIVE',
    sort: 'price',
    order: 'asc',
  });
  assert.equal(sql.includes(search), false);
  assert.match(sql, /ORDER BY price_value ASC, id ASC/);
  assert.deepEqual(parameters, ["%phone\\%' OR 1=1 --%", 'ACTIVE', 10, 30]);
  assert.deepEqual(result, { data: [], total: 12 });
});

test('repository updates only known columns using bound values', async () => {
  const pool = {
    async query(text: string, values: unknown[]) {
      assert.equal(text.includes('untrusted'), false);
      assert.match(text, /name = \$2, description = \$3/);
      assert.deepEqual(values, ['id', 'untrusted', null]);
      return { rows: [] };
    },
  } as unknown as Pool;
  assert.equal(
    await new ProductRepository(transactionPool(pool)).update('id', {
      name: 'untrusted',
      description: null,
    }),
    null,
  );
});

test('known constraint errors are translated while unknown failures remain observable', async () => {
  const pool = {
    async query() {
      throw {
        code: '23505',
        constraint: 'products_slug_key',
        detail: 'private SQL',
      };
    },
  } as unknown as Pool;
  await assert.rejects(
    new ProductRepository(transactionPool(pool)).create(input),
    (error) =>
      error instanceof PersistenceError &&
      error.kind === 'duplicate-slug' &&
      !error.message.includes('SQL'),
  );
  assert.throws(
    () =>
      rethrowDatabaseError({
        code: '23503',
        constraint: 'products_category_id_fkey',
      }),
    (error) =>
      error instanceof PersistenceError && error.kind === 'missing-category',
  );
  const unexpected = new Error('connection reset');
  assert.throws(
    () => rethrowDatabaseError(unexpected),
    (error) => error === unexpected,
  );
});
