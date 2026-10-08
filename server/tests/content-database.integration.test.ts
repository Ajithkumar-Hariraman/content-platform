import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createDatabase } from '../src/database/pool.js';
import { runMigrations } from '../src/database/migrations.js';
import { ContentRepository } from '../src/repositories/content-repository.js';
import { ContentService } from '../src/services/content-service.js';
import { AppError } from '../src/errors/app-error.js';
import { query } from './content-fixtures.js';
test(
  'PostgreSQL content persistence, visibility, constraints and lifecycle',
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const database = createDatabase(process.env.TEST_DATABASE_URL!);
    const slug = `integration-${randomUUID()}`;
    let contentId: string | undefined;
    try {
      await runMigrations(database.pool);
      const service = new ContentService(new ContentRepository(database.pool));
      const created = await service.create({ title: slug, slug, body: 'Body' });
      contentId = created.id;
      assert.equal(created.status, 'DRAFT');
      assert.equal(
        (await service.list({ ...query, search: slug }, true)).pagination.total,
        0,
      );
      await assert.rejects(
        service.findPublishedBySlug(slug),
        (error) => error instanceof AppError && error.statusCode === 404,
      );
      await assert.rejects(
        service.create({ title: slug, slug, body: 'Duplicate' }),
        (error) => error instanceof AppError && error.statusCode === 409,
      );
      const published = await service.publish(created.id);
      assert.deepEqual(await service.publish(created.id), published);
      assert.equal((await service.findPublishedBySlug(slug)).id, created.id);
      assert.equal(
        (await service.list({ ...query, search: slug }, true)).pagination.total,
        1,
      );
      assert.equal(
        (await service.update(created.id, { summary: 'Updated' })).summary,
        'Updated',
      );
      await service.archive(created.id);
      assert.equal(
        (await service.list({ ...query, search: slug }, true)).pagination.total,
        0,
      );
      await assert.rejects(
        service.findPublishedBySlug(slug),
        (error) => error instanceof AppError && error.statusCode === 404,
      );
      await assert.rejects(
        service.publish(created.id),
        (error) => error instanceof AppError && error.statusCode === 409,
      );
      await assert.rejects(
        database.pool.query('UPDATE contents SET status=$1 WHERE id=$2', [
          'INVALID',
          created.id,
        ]),
        (error) =>
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === '23514',
      );
      await service.delete(created.id);
    } finally {
      try {
        if (contentId)
          await database.pool.query(
            'DELETE FROM outbox_events WHERE entity_id=$1',
            [contentId],
          );
        await database.pool.query('DELETE FROM contents WHERE slug=$1', [slug]);
      } finally {
        await database.close();
      }
    }
  },
);
