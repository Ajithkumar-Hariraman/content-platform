import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PoolClient } from 'pg';
import { inTransaction } from '../src/database/transaction.js';

test('transaction commits success and rolls back failed operations', async () => {
  const statements: string[] = [];
  const client = {
    async query(sql: string) {
      statements.push(sql);
    },
  } as unknown as PoolClient;
  assert.equal(await inTransaction(client, async () => 'done'), 'done');
  assert.deepEqual(statements, ['BEGIN', 'COMMIT']);
  statements.length = 0;
  const error = new Error('operation failed');
  await assert.rejects(
    inTransaction(client, async () => {
      throw error;
    }),
    (failure) => failure === error,
  );
  assert.deepEqual(statements, ['BEGIN', 'ROLLBACK']);
});

test('rollback failures preserve both causes', async () => {
  const original = new Error('write failed');
  const rollback = new Error('rollback failed');
  const client = {
    async query(sql: string) {
      if (sql === 'ROLLBACK') throw rollback;
    },
  } as unknown as PoolClient;
  await assert.rejects(
    inTransaction(client, async () => {
      throw original;
    }),
    (error) =>
      error instanceof AggregateError &&
      error.errors[0] === original &&
      error.errors[1] === rollback,
  );
});
