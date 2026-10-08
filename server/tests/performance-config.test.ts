import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readPoolConfig,
  readPerformanceConfig,
} from '../src/config/performance.js';
import { performanceQueries } from '../src/performance/queries.js';
test('pool defaults and explicit configuration bound connection resources', () => {
  assert.deepEqual(readPoolConfig({}), {
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  assert.equal(readPoolConfig({ DB_POOL_MAX: '20' }).max, 20);
  for (const env of [
    { DB_POOL_MAX: '0' },
    { DB_POOL_MAX: '1.5' },
    { DB_POOL_IDLE_TIMEOUT_MS: '-1' },
    { DB_POOL_CONNECTION_TIMEOUT_MS: '0' },
  ])
    assert.throws(() => readPoolConfig(env));
});
test('performance mode cannot bypass production/test rate limits; cache config validates URL/timeouts', () => {
  assert.equal(
    readPerformanceConfig({ NODE_ENV: 'development', PERFORMANCE_MODE: 'true' })
      .performanceMode,
    true,
  );
  assert.throws(() =>
    readPerformanceConfig({ NODE_ENV: 'production', PERFORMANCE_MODE: 'true' }),
  );
  assert.throws(() => readPerformanceConfig({ REDIS_URL: 'http://localhost' }));
  assert.throws(
    () => readPerformanceConfig({ REDIS_URL: 'redis://secret-password@[' }),
    (error) =>
      error instanceof Error && !error.message.includes('secret-password'),
  );
  assert.throws(() => readPerformanceConfig({ CACHE_ENABLED: 'maybe' }));
  assert.throws(() => readPerformanceConfig({ CACHE_TIMEOUT_MS: '0' }));
  assert.equal(
    readPerformanceConfig({ REDIS_URL: 'redis://127.0.0.1:56379' })
      .cacheEnabled,
    true,
  );
  assert.equal(
    readPerformanceConfig({
      REDIS_URL: 'rediss://cache.example',
      CACHE_ENABLED: 'false',
    }).cacheEnabled,
    false,
  );
});
test('representative queries use production builders and parameterized visibility/filter SQL', () => {
  assert.match(performanceQueries['product-list'].text, /JOIN categories/);
  assert.match(performanceQueries['product-search'].text, /ILIKE \$1/);
  assert.equal(performanceQueries['product-search'].values[0], '%Performance%');
  assert.match(
    performanceQueries['product-category'].text,
    /category_id = \$1/,
  );
  assert.match(
    performanceQueries['public-content-list'].text,
    /status = 'PUBLISHED'/,
  );
  assert.match(
    performanceQueries['content-slug'].text,
    /slug=\$1 AND status='PUBLISHED'/,
  );
});
