import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inTransaction } from '../src/database/transaction.js';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createDatabase } from '../src/database/pool.js';
import { runMigrations } from '../src/database/migrations.js';
import { ProductRepository } from '../src/repositories/product-repository.js';
import { CategoryRepository } from '../src/repositories/category-repository.js';
import { ProductService } from '../src/services/product-service.js';
import { AppError } from '../src/errors/app-error.js';

test(
  'PostgreSQL migrations and catalog repositories work against a dedicated database',
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const database = createDatabase(process.env.TEST_DATABASE_URL!);
    const categoryId = randomUUID();
    const productIds: string[] = [];
    const prefix = `integration-${randomUUID()}`;
    try {
      await database.checkConnection();
      await runMigrations(database.pool);
      await runMigrations(database.pool);
      await database.pool.query(
        'INSERT INTO categories (id, name, slug) VALUES ($1, $2, $3)',
        [categoryId, prefix, prefix],
      );
      const categories = new CategoryRepository(database.pool);
      const service = new ProductService(
        new ProductRepository(database.pool),
        categories,
      );
      assert.equal((await categories.findById(categoryId))?.id, categoryId);
      const input = {
        name: `${prefix} first`,
        slug: `${prefix}-first`,
        price: '100.01',
        status: 'ACTIVE',
        categoryId,
      } as const;
      const first = await service.create(input);
      productIds.push(first.id);
      const second = await service.create({
        ...input,
        name: `${prefix} second`,
        slug: `${prefix}-second`,
        price: '9.99',
      });
      productIds.push(second.id);
      assert.equal((await service.findById(first.id)).price, '100.01');
      const page = await service.findAll({
        page: 1,
        limit: 1,
        categoryId,
        status: 'ACTIVE',
        search: prefix,
        sort: 'price',
        order: 'asc',
      });
      assert.equal(page.data[0]?.id, second.id);
      assert.deepEqual(page.pagination, {
        page: 1,
        limit: 1,
        total: 2,
        totalPages: 2,
      });
      const beyond = await service.findAll({
        page: 10,
        limit: 1,
        categoryId,
        sort: 'createdAt',
        order: 'desc',
      });
      assert.equal(beyond.data.length, 0);
      assert.equal(beyond.pagination.total, 2);
      await assert.rejects(
        service.create(input),
        (error) => error instanceof AppError && error.statusCode === 409,
      );
      assert.equal(
        (
          await service.update(first.id, {
            description: 'Updated',
            price: '0.01',
          })
        ).price,
        '0.01',
      );
      await service.delete(first.id);
      await assert.rejects(
        service.findById(first.id),
        (error) => error instanceof AppError && error.statusCode === 404,
      );
    } finally {
      try {
        await database.pool.query(
          'DELETE FROM outbox_events WHERE entity_id=ANY($1::uuid[])',
          [productIds],
        );
        await database.pool.query(
          'DELETE FROM products WHERE category_id = $1',
          [categoryId],
        );
        await database.pool.query('DELETE FROM categories WHERE id = $1', [
          categoryId,
        ]);
      } finally {
        await database.close();
      }
    }
  },
);

test(
  'development seed repeats without duplicate records or timestamp changes',
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const database = createDatabase(process.env.TEST_DATABASE_URL!);
    try {
      await runMigrations(database.pool);
      const sql = await readFile(
        new URL('../seeds/development.sql', import.meta.url),
        'utf8',
      );
      const client = await database.pool.connect();
      try {
        await inTransaction(client, async () => {
          await client.query(sql);
        });
        const before = await client.query(
          'SELECT id, slug, updated_at FROM products ORDER BY slug',
        );
        await inTransaction(client, async () => {
          await client.query(sql);
        });
        const after = await client.query(
          'SELECT id, slug, updated_at FROM products ORDER BY slug',
        );
        assert.deepEqual(after.rows, before.rows);
        const seeded =
          await client.query(`SELECT count(*)::text AS total FROM products WHERE slug IN
        ('wireless-headphones', 'compact-smartphone', 'usb-c-dock', 'designing-data-intensive-applications',
        'the-pragmatic-programmer', 'adjustable-desk-lamp', 'ergonomic-keyboard')`);
        assert.equal(seeded.rows[0]?.total, '7');
      } finally {
        client.release();
      }
    } finally {
      await database.close();
    }
  },
);
