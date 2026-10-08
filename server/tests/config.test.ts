import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConfig } from '../src/config/env.js';

const config = readConfig({
  NODE_ENV: 'test',
  CLIENT_ORIGIN: 'http://localhost:5173',
});

test('startup configuration validates environment inputs', () => {
  assert.throws(
    () => readConfig({ CLIENT_ORIGIN: config.clientOrigin, PORT: '0' }),
    /PORT/,
  );
  assert.throws(
    () =>
      readConfig({ CLIENT_ORIGIN: config.clientOrigin, NODE_ENV: 'staging' }),
    /NODE_ENV/,
  );
  assert.throws(() => readConfig({}), /CLIENT_ORIGIN/);
  assert.throws(
    () => readConfig({ CLIENT_ORIGIN: 'http://localhost:5173/path' }),
    /CLIENT_ORIGIN/,
  );
  assert.throws(
    () =>
      readConfig({
        CLIENT_ORIGIN: config.clientOrigin,
        DATABASE_URL: 'https://example.com',
      }),
    /DATABASE_URL/,
  );
  assert.equal(config.databaseUrl, undefined);
});
