import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseCreateProduct,
  parseUpdateProduct,
  parseProductQuery,
  parseProductId,
} from '../src/validation/products.js';
import { AppError } from '../src/errors/app-error.js';
import { input } from './fixtures.js';
const invalid = (error: unknown) =>
  error instanceof AppError && error.statusCode === 400;

test('validation defaults queries and rejects unsafe sorting, arrays, and oversized pagination', () => {
  assert.deepEqual(parseProductQuery({}), {
    page: 1,
    limit: 10,
    sort: 'createdAt',
    order: 'desc',
  });
  for (const query of [
    { sort: 'price;DROP TABLE products' },
    { order: 'drop' },
    { page: '0' },
    { page: '1.5' },
    { page: ['1', '2'] },
    { limit: '101' },
    { categoryId: 'bad' },
    { search: 'x'.repeat(201) },
    { unknown: 'x' },
  ])
    assert.throws(() => parseProductQuery(query), invalid);
});

test('validation preserves exact decimal strings and rejects precision loss', () => {
  for (const price of ['0', '0.01', '10.10', '9999999999.99'])
    assert.equal(parseCreateProduct({ ...input, price }).price, price);
  for (const price of [
    1.1,
    '-1',
    '1.234',
    '10000000000.00',
    '1e3',
    'NaN',
    '01.20',
  ])
    assert.throws(() => parseCreateProduct({ ...input, price }), invalid);
});

test('PATCH rejects empty and unknown fields while preserving null description', () => {
  for (const patch of [
    {},
    { id: 'bad' },
    { status: 'UNKNOWN' },
    { name: ' ' },
    { name: undefined },
  ])
    assert.throws(() => parseUpdateProduct(patch), invalid);
  assert.deepEqual(parseUpdateProduct({ description: null }), {
    description: null,
  });
  assert.throws(() => parseProductId('bad'), invalid);
});
