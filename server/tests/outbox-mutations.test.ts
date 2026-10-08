import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Pool } from 'pg';
import { ProductRepository } from '../src/repositories/product-repository.js';
import { ContentRepository } from '../src/repositories/content-repository.js';
import { activityEventSchema } from '../src/events/activity-event.js';
import { input as productInput, product } from './fixtures.js';
import { input as contentInput, id } from './content-fixtures.js';
const productRow = {
  id: product.id,
  name: product.name,
  slug: product.slug,
  description: product.description,
  price: product.price,
  status: product.status,
  category_id: product.categoryId,
  category_name: product.category.name,
  category_slug: product.category.slug,
  created_at: product.createdAt,
  updated_at: product.updatedAt,
};
const contentRow = {
  id,
  title: 'Title',
  slug: contentInput.slug,
  summary: null,
  body: 'Body',
  status: 'DRAFT',
  published_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};
function fixture(
  row: object,
  { failMutation = false, failOutbox = false, missing = false } = {},
) {
  const statements: string[] = [];
  const events: unknown[] = [];
  let stagedEvents: unknown[] = [];
  let committedMutation = false;
  let stagedMutation = false;
  let released = 0;
  const client = {
    async query(sql: string, values?: unknown[]) {
      statements.push(sql);
      if (sql === 'BEGIN') return { rows: [] };
      if (sql === 'COMMIT') {
        committedMutation = stagedMutation;
        events.push(...stagedEvents);
        return { rows: [] };
      }
      if (sql === 'ROLLBACK') {
        stagedMutation = false;
        stagedEvents = [];
        return { rows: [] };
      }
      if (sql.startsWith('INSERT INTO outbox_events')) {
        if (failOutbox) throw new Error('Outbox insert failed');
        stagedEvents.push(JSON.parse(String(values?.[4])));
        return { rows: [] };
      }
      if (failMutation) throw new Error('Mutation failed');
      if (sql.startsWith('SELECT')) return { rows: missing ? [] : [row] };
      if (missing) return { rows: [] };
      stagedMutation = true;
      return { rows: [row] };
    },
    release() {
      released++;
    },
  };
  const pool = {
    async connect() {
      return client;
    },
  } as unknown as Pool;
  return {
    pool,
    statements,
    events,
    committed: () => committedMutation,
    released: () => released,
  };
}
test('Product create/update/delete each commit a matching outbox event', async () => {
  for (const operation of ['create', 'update', 'delete'] as const) {
    const f = fixture(productRow);
    const repository = new ProductRepository(f.pool);
    if (operation === 'create') await repository.create(productInput);
    else if (operation === 'update')
      await repository.update(product.id, { name: 'New' });
    else await repository.delete(product.id);
    assert.equal(f.committed(), true);
    assert.equal(f.events.length, 1);
    const event = activityEventSchema.parse(f.events[0]);
    assert.equal(
      event.eventType,
      `PRODUCT_${operation === 'create' ? 'CREATED' : operation === 'update' ? 'UPDATED' : 'DELETED'}`,
    );
    assert.equal(event.entityId, product.id);
    assert.equal(f.statements[0], 'BEGIN');
    assert.equal(f.statements.at(-1), 'COMMIT');
    assert.equal(f.released(), 1);
    assert.equal(JSON.stringify(event).includes('description'), false);
  }
});
test('Content create/update/delete commit matching minimal events', async () => {
  for (const operation of ['create', 'update', 'delete'] as const) {
    const f = fixture(contentRow);
    const repository = new ContentRepository(f.pool);
    if (operation === 'create') await repository.create(contentInput);
    else if (operation === 'update')
      await repository.update(id, { title: 'New' });
    else await repository.delete(id);
    assert.equal(f.committed(), true);
    assert.equal(f.events.length, 1);
    const event = activityEventSchema.parse(f.events[0]);
    assert.equal(
      event.eventType,
      `CONTENT_${operation === 'create' ? 'CREATED' : operation === 'update' ? 'UPDATED' : 'DELETED'}`,
    );
    assert.equal(event.entityId, id);
    assert.equal('body' in event.data, false);
  }
});
test('domain failure or outbox failure rolls back both writes and releases the client', async () => {
  for (const row of [productRow, contentRow])
    for (const failure of [{ failMutation: true }, { failOutbox: true }]) {
      const f = fixture(row, failure);
      await assert.rejects(
        row === productRow
          ? new ProductRepository(f.pool).create(productInput)
          : new ContentRepository(f.pool).create(contentInput),
      );
      assert.equal(f.committed(), false);
      assert.equal(f.events.length, 0);
      assert.equal(f.statements.at(-1), 'ROLLBACK');
      assert.equal(f.released(), 1);
      if (failure.failMutation)
        assert.equal(
          f.statements.some((sql) =>
            sql.startsWith('INSERT INTO outbox_events'),
          ),
          false,
        );
    }
});
test('missing writes and repeated publish/archive do not emit events', async () => {
  for (const operation of ['update', 'delete', 'publish', 'archive'] as const) {
    const f = fixture(contentRow, { missing: true });
    const repository = new ContentRepository(f.pool);
    if (operation === 'update') await repository.update(id, { title: 'New' });
    else await repository[operation](id);
    assert.equal(f.events.length, 0);
  }
  for (const status of ['PUBLISHED', 'ARCHIVED']) {
    const f = fixture({
      ...contentRow,
      status,
      published_at: '2026-01-01T00:00:00Z',
    });
    const repository = new ContentRepository(f.pool);
    if (status === 'PUBLISHED') await repository.publish(id);
    else await repository.archive(id);
    assert.equal(f.events.length, 0);
    assert.equal(f.committed(), false);
  }
});
test('publish and archive write lifecycle events within the locked transaction', async () => {
  for (const operation of ['publish', 'archive'] as const) {
    const f = fixture(contentRow);
    await new ContentRepository(f.pool)[operation](id);
    assert.ok(f.statements.some((sql) => sql.includes('FOR UPDATE')));
    assert.equal(f.events.length, 1);
    assert.equal(
      activityEventSchema.parse(f.events[0]).eventType,
      operation === 'publish' ? 'CONTENT_PUBLISHED' : 'CONTENT_ARCHIVED',
    );
    assert.equal(f.statements.at(-1), 'COMMIT');
  }
});
