import {
  testAuthentication,
  authenticatedAgent,
} from './auth-http-fixtures.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config/env.js';
import { PersistenceError } from '../src/repositories/persistence-error.js';
import { fixtures, product, input, category } from './fixtures.js';

const config = readConfig({
  NODE_ENV: 'test',
  CLIENT_ORIGIN: 'http://localhost:5173',
});

test('GET products passes validated filters and returns pagination', async () => {
  const fixture = fixtures();
  fixture.products.findAll = async (query) => {
    assert.deepEqual(query, {
      page: 2,
      limit: 2,
      search: 'phone',
      categoryId: category.id,
      status: 'ACTIVE',
      sort: 'price',
      order: 'asc',
    });
    return { data: [product], total: 5 };
  };
  const response = await authenticatedAgent(
    createApp(
      config,
      fixture.catalog,
      undefined,
      undefined,
      undefined,
      testAuthentication(),
    ),
  ).get(
    `/api/v1/products?page=2&limit=2&search=phone&categoryId=${category.id}&status=ACTIVE&sort=price&order=asc`,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.pagination, {
    page: 2,
    limit: 2,
    total: 5,
    totalPages: 3,
  });
  assert.equal(response.body.data[0].price, '129.99');
});

test('GET item and categories use data envelopes', async () => {
  const app = createApp(
    config,
    fixtures().catalog,
    undefined,
    undefined,
    undefined,
    testAuthentication(),
  );
  const item = await authenticatedAgent(app).get(
    `/api/v1/products/${product.id}`,
  );
  assert.equal(item.status, 200);
  assert.deepEqual(item.body.data, product);
  const categories = await authenticatedAgent(app).get('/api/v1/categories');
  assert.equal(categories.status, 200);
  assert.deepEqual(categories.body.data, [category]);
});

test('missing products return 404 and malformed ids return 400', async () => {
  const fixture = fixtures();
  fixture.products.findById = async () => null;
  const app = createApp(
    config,
    fixture.catalog,
    undefined,
    undefined,
    undefined,
    testAuthentication(),
  );
  assert.equal(
    (await authenticatedAgent(app).get(`/api/v1/products/${product.id}`))
      .status,
    404,
  );
  assert.equal(
    (await authenticatedAgent(app).get('/api/v1/products/not-a-uuid')).status,
    400,
  );
});

test('POST creates a product and returns its location', async () => {
  const response = await authenticatedAgent(
    createApp(
      config,
      fixtures().catalog,
      undefined,
      undefined,
      undefined,
      testAuthentication(),
    ),
  )
    .post('/api/v1/products')
    .send(input);
  assert.equal(response.status, 201);
  assert.equal(response.headers.location, `/api/v1/products/${product.id}`);
  assert.deepEqual(response.body.data, product);
});

test('POST rejects invalid price, unknown fields, and missing category', async () => {
  const fixture = fixtures();
  const app = createApp(
    config,
    fixture.catalog,
    undefined,
    undefined,
    undefined,
    testAuthentication(),
  );
  for (const invalid of [
    { ...input, price: 1.23 },
    { ...input, price: '-1.00' },
    { ...input, price: '1.234' },
    { ...input, unexpected: true },
    { ...input, status: 'PUBLISHED' },
  ]) {
    assert.equal(
      (await authenticatedAgent(app).post('/api/v1/products').send(invalid))
        .status,
      400,
    );
  }
  fixture.categories.findById = async () => null;
  const response = await authenticatedAgent(app)
    .post('/api/v1/products')
    .send(input);
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'INVALID_CATEGORY');
});

test('duplicate slug returns a safe conflict', async () => {
  const fixture = fixtures();
  fixture.products.create = async () => {
    throw new PersistenceError('duplicate-slug');
  };
  const response = await authenticatedAgent(
    createApp(
      config,
      fixture.catalog,
      undefined,
      undefined,
      undefined,
      testAuthentication(),
    ),
  )
    .post('/api/v1/products')
    .send(input);
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'DUPLICATE_SLUG');
  assert.equal(response.body.error.message.includes('constraint'), false);
});

test('PATCH updates accepted fields and rejects empty or arbitrary updates', async () => {
  const app = createApp(
    config,
    fixtures().catalog,
    undefined,
    undefined,
    undefined,
    testAuthentication(),
  );
  const response = await authenticatedAgent(app)
    .patch(`/api/v1/products/${product.id}`)
    .send({ name: 'Updated headphones' });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.name, 'Updated headphones');
  for (const invalid of [{}, { id: product.id }, { status: 'UNKNOWN' }])
    assert.equal(
      (
        await authenticatedAgent(app)
          .patch(`/api/v1/products/${product.id}`)
          .send(invalid)
      ).status,
      400,
    );
});

test('DELETE returns 204 without a body and 404 when missing', async () => {
  const fixture = fixtures();
  const app = createApp(
    config,
    fixture.catalog,
    undefined,
    undefined,
    undefined,
    testAuthentication(),
  );
  const response = await authenticatedAgent(app).delete(
    `/api/v1/products/${product.id}`,
  );
  assert.equal(response.status, 204);
  assert.equal(response.text, '');
  fixture.products.delete = async () => false;
  assert.equal(
    (await authenticatedAgent(app).delete(`/api/v1/products/${product.id}`))
      .status,
    404,
  );
});

test('invalid list queries return 400', async () => {
  const app = createApp(
    config,
    fixtures().catalog,
    undefined,
    undefined,
    undefined,
    testAuthentication(),
  );
  for (const query of [
    'page=0',
    'limit=101',
    'sort=price;DROP',
    'order=sideways',
    'categoryId=no',
    'status=no',
    'page=1&page=2',
    'unknown=x',
  ]) {
    assert.equal(
      (await authenticatedAgent(app).get(`/api/v1/products?${query}`)).status,
      400,
    );
  }
});
