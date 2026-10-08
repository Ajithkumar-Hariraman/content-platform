import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readDatabaseConfig } from '../src/config/database.js';
import { redact } from '../src/logging/redact.js';
const discrete = {
  DB_HOST: 'database.internal',
  DB_PORT: '5432',
  DB_NAME: 'cloudops',
  DB_USER: 'user',
  DB_PASSWORD: 'test-secret',
};
test('database configuration supports local URLs and complete discrete credentials', () => {
  assert.equal(
    readDatabaseConfig({
      DATABASE_URL: 'postgres://user:password@localhost/cloudops',
    })?.connectionString,
    'postgres://user:password@localhost/cloudops',
  );
  assert.equal(readDatabaseConfig(discrete)?.host, discrete.DB_HOST);
  assert.equal(readDatabaseConfig({}), undefined);
});
test('mixed, incomplete and invalid database settings fail without leaking credentials', () => {
  for (const env of [
    {
      ...discrete,
      DATABASE_URL: 'postgres://user:password@localhost/cloudops',
    },
    { DB_HOST: 'localhost' },
    { ...discrete, DB_PORT: '0' },
    { DATABASE_URL: 'test-secret' },
  ]) {
    assert.throws(
      () => readDatabaseConfig(env),
      (e: unknown) => e instanceof Error && !e.message.includes('test-secret'),
    );
  }
  assert.throws(
    () => readDatabaseConfig({ NODE_ENV: 'production' }),
    /Production/,
  );
  assert.throws(
    () => readDatabaseConfig({ ...discrete, NODE_ENV: 'production' }),
    /TLS/,
  );
  assert.equal(redact('failed test-secret', discrete), 'failed [REDACTED]');
});
