import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/errors/app-error.js';
import { PersistenceError } from '../src/repositories/persistence-error.js';
import { fixtures, input, product } from './fixtures.js';

function hasError(status: number, code: string) {
  return (error: unknown) =>
    error instanceof AppError &&
    error.statusCode === status &&
    error.code === code;
}

test('service creates products only when category exists', async () => {
  const fixture = fixtures();
  assert.deepEqual(await fixture.catalog.products.create(input), product);
  let writes = 0;
  fixture.products.create = async () => {
    writes++;
    return product;
  };
  fixture.categories.findById = async () => null;
  await assert.rejects(
    fixture.catalog.products.create(input),
    hasError(400, 'INVALID_CATEGORY'),
  );
  assert.equal(writes, 0);
});

test('service handles missing reads, updates, deletes, and concurrent disappearance', async () => {
  const fixture = fixtures();
  fixture.products.findById = async () => null;
  await assert.rejects(
    fixture.catalog.products.findById(product.id),
    hasError(404, 'PRODUCT_NOT_FOUND'),
  );
  await assert.rejects(
    fixture.catalog.products.update(product.id, { name: 'Updated' }),
    hasError(404, 'PRODUCT_NOT_FOUND'),
  );
  fixture.products.findById = async () => product;
  fixture.products.update = async () => null;
  await assert.rejects(
    fixture.catalog.products.update(product.id, { name: 'Updated' }),
    hasError(404, 'PRODUCT_NOT_FOUND'),
  );
  fixture.products.delete = async () => false;
  await assert.rejects(
    fixture.catalog.products.delete(product.id),
    hasError(404, 'PRODUCT_NOT_FOUND'),
  );
});

test('service maps write conflicts and preserves unexpected failures for logging', async () => {
  const fixture = fixtures();
  fixture.products.create = async () => {
    throw new PersistenceError('duplicate-slug');
  };
  await assert.rejects(
    fixture.catalog.products.create(input),
    hasError(409, 'DUPLICATE_SLUG'),
  );
  fixture.products.update = async () => {
    throw new PersistenceError('missing-category');
  };
  await assert.rejects(
    fixture.catalog.products.update(product.id, {
      categoryId: input.categoryId,
    }),
    hasError(400, 'INVALID_CATEGORY'),
  );
  const unexpected = new Error('connection lost');
  fixture.products.create = async () => {
    throw unexpected;
  };
  await assert.rejects(
    fixture.catalog.products.create(input),
    (error) => error === unexpected,
  );
});

test('pagination metadata handles partial pages and zero results', async () => {
  const fixture = fixtures();
  const query = {
    page: 3,
    limit: 2,
    sort: 'createdAt',
    order: 'desc',
  } as const;
  assert.deepEqual((await fixture.catalog.products.findAll(query)).pagination, {
    page: 3,
    limit: 2,
    total: 5,
    totalPages: 3,
  });
  fixture.products.findAll = async () => ({ data: [], total: 0 });
  assert.deepEqual(await fixture.catalog.products.findAll(query), {
    data: [],
    pagination: { page: 3, limit: 2, total: 0, totalPages: 0 },
  });
});

test('update validates a changed category and allows explicit description clearing', async () => {
  const fixture = fixtures();
  fixture.categories.findById = async () => null;
  await assert.rejects(
    fixture.catalog.products.update(product.id, {
      categoryId: input.categoryId,
    }),
    hasError(400, 'INVALID_CATEGORY'),
  );
  fixture.products.update = async (_id, patch) => {
    assert.deepEqual(patch, { description: null });
    return { ...product, description: null };
  };
  assert.equal(
    (await fixture.catalog.products.update(product.id, { description: null }))
      .description,
    null,
  );
});
