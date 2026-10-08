import assert from 'node:assert/strict';
import { test } from 'node:test';
import { queryKeys, matchesDomain } from '../../client/src/query/keys.js';
test('frontend query keys normalize defaults, keep filters distinct and isolate administrative principals', () => {
  const product = { page: 1, limit: 10 };
  assert.deepEqual(
    queryKeys.products(product),
    queryKeys.products({
      ...product,
      sort: 'createdAt',
      order: 'desc',
      search: ' ',
    }),
  );
  assert.notDeepEqual(
    queryKeys.products(product),
    queryKeys.products({ ...product, page: 2 }),
  );
  const content = {
    page: 1,
    limit: 10,
    sort: 'publishedAt',
    order: 'desc',
  } as const;
  assert.notDeepEqual(
    queryKeys.content(content),
    queryKeys.content(content, 'admin-1'),
  );
  assert.notDeepEqual(
    queryKeys.content(content, 'admin-1'),
    queryKeys.content(content, 'admin-2'),
  );
  assert.notDeepEqual(
    queryKeys.users('admin-1', 1),
    queryKeys.users('admin-2', 1),
  );
});
test('mutation invalidation includes lists, details and activity while preserving unrelated domains', () => {
  assert.equal(matchesDomain(queryKeys.product('ID'), 'products'), true);
  assert.equal(
    matchesDomain(queryKeys.products({ page: 1, limit: 10 }), 'products'),
    true,
  );
  assert.equal(
    matchesDomain(queryKeys.activity('admin', { limit: 20 }), 'content'),
    true,
  );
  assert.equal(
    matchesDomain(queryKeys.contentDetail('guide'), 'content'),
    true,
  );
  assert.equal(matchesDomain(queryKeys.users('admin', 1), 'content'), false);
  assert.equal(matchesDomain(queryKeys.categories(), 'products'), false);
});
