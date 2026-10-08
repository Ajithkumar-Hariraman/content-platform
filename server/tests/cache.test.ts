import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PublicCache, type CacheStore } from '../src/cache/public-cache.js';
import { Metrics } from '../src/metrics/registry.js';
import {
  cacheKey,
  productListIdentity,
  contentListIdentity,
} from '../src/cache/keys.js';
import { ContentService } from '../src/services/content-service.js';
import { contentFixture, input, query } from './content-fixtures.js';
function fixture() {
  let version = 1;
  let unavailable = false;
  const stored = new Map<string, string>();
  const counters = new Metrics();
  const ttls: number[] = [];
  const store: CacheStore = {
    async get(key) {
      if (unavailable) throw new Error('Redis unavailable');
      return stored.get(key) ?? null;
    },
    async set(key, value, ttl) {
      if (unavailable) throw new Error('Redis unavailable');
      ttls.push(ttl);
      stored.set(key, value);
    },
  };
  return {
    cache: new PublicCache(
      store,
      {
        async current() {
          return String(version);
        },
      },
      60,
      counters,
    ),
    stored,
    counters,
    ttls,
    advance() {
      version++;
    },
    fail(value = true) {
      unavailable = value;
    },
  };
}
test('cache miss loads and sets bounded TTL; hit avoids subsequent domain read', async () => {
  const f = fixture();
  let reads = 0;
  const load = async () => {
    reads++;
    return { title: 'Current' };
  };
  assert.deepEqual(await f.cache.read('CONTENT', 'slug', 'guide', load), {
    title: 'Current',
  });
  assert.deepEqual(await f.cache.read('CONTENT', 'slug', 'guide', load), {
    title: 'Current',
  });
  assert.equal(reads, 1);
  assert.deepEqual(f.ttls, [60]);
  assert.equal(f.counters.snapshot().counters.cache_hit_total, 1);
  assert.equal(f.counters.snapshot().counters.cache_miss_total, 1);
});
test('generation invalidates lists and details; domains and parameters stay isolated', async () => {
  const f = fixture();
  let title = 'Old';
  const load = async () => ({ title });
  await f.cache.read('CONTENT', 'slug', 'guide', load);
  await f.cache.read('CONTENT', 'list', 'filters', load);
  title = 'New';
  f.advance();
  assert.deepEqual(await f.cache.read('CONTENT', 'slug', 'guide', load), {
    title: 'New',
  });
  assert.deepEqual(await f.cache.read('CONTENT', 'list', 'filters', load), {
    title: 'New',
  });
  assert.notEqual(
    cacheKey('PRODUCT', '1', 'id', 'a'),
    cacheKey('CONTENT', '1', 'id', 'a'),
  );
});
test('Redis read/write failure falls back; recovered Redis cannot resurrect invalidated content', async () => {
  const f = fixture();
  let visible = true;
  const load = async () =>
    visible ? { title: 'Published' } : { missing: true };
  await f.cache.read('CONTENT', 'slug', 'guide', load);
  f.fail();
  visible = false;
  f.advance();
  assert.deepEqual(await f.cache.read('CONTENT', 'slug', 'guide', load), {
    missing: true,
  });
  f.fail(false);
  assert.deepEqual(await f.cache.read('CONTENT', 'slug', 'guide', load), {
    missing: true,
  });
  assert.equal(f.counters.snapshot().counters.cache_error_total, 2);
});
test('archive prevents cached public detail/list from returning published content', async () => {
  const f = fixture();
  const domain = contentFixture();
  const repository = {
    ...domain.repository,
    async archive(id: string) {
      const result = await domain.repository.archive(id);
      if (result) f.advance();
      return result;
    },
  };
  const service = new ContentService(repository, f.cache);
  const created = await service.create(input);
  await service.publish(created.id);
  await service.findPublishedBySlug(created.slug);
  await service.list(query, true);
  await service.archive(created.id);
  await assert.rejects(
    service.findPublishedBySlug(created.slug),
    /Content not found/,
  );
  assert.deepEqual((await service.list(query, true)).data, []);
});
test('in-flight stale load is not written under a new generation; failed loads are never cached', async () => {
  const f = fixture();
  await f.cache.read('CONTENT', 'slug', 'guide', async () => {
    f.advance();
    return { title: 'Old snapshot' };
  });
  assert.equal(f.stored.size, 0);
  await assert.rejects(
    f.cache.read('CONTENT', 'slug', 'missing', async () => {
      throw new Error('Not found');
    }),
  );
  assert.equal(f.stored.size, 0);
});
test('generation failures bypass Redis and corrupt JSON is replaced from persistence', async () => {
  const f = fixture();
  f.stored.set(cacheKey('CONTENT', '1', 'slug', 'guide'), '{');
  assert.deepEqual(
    await f.cache.read('CONTENT', 'slug', 'guide', async () => ({
      title: 'Current',
    })),
    { title: 'Current' },
  );
  const unavailable = new PublicCache(
    {
      async get() {
        throw new Error('Must bypass');
      },
      async set() {
        throw new Error('Must bypass');
      },
    },
    {
      async current() {
        throw new Error('Versions unavailable');
      },
    },
  );
  assert.deepEqual(
    await unavailable.read('CONTENT', 'slug', 'guide', async () => ({
      title: 'Fallback',
    })),
    { title: 'Fallback' },
  );
});
test('list identities normalize optional filters and include page/sort/search/category/status', () => {
  const p = { page: 1, limit: 20, sort: 'createdAt', order: 'desc' } as const;
  assert.equal(
    productListIdentity(p),
    productListIdentity({ ...p, search: ' ' }),
  );
  assert.notEqual(
    productListIdentity(p),
    productListIdentity({ ...p, page: 2 }),
  );
  assert.notEqual(
    productListIdentity(p),
    productListIdentity({ ...p, status: 'ACTIVE' }),
  );
  assert.notEqual(
    productListIdentity(p),
    productListIdentity({ ...p, search: 'cloud' }),
  );
  assert.equal(
    contentListIdentity(query),
    contentListIdentity({ ...query, status: 'ARCHIVED' }),
  );
});
