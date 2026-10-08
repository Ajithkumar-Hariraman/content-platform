import assert from 'node:assert/strict';
import { test } from 'node:test';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { PostgresCacheVersions } from '../src/cache/versions.js';
import { PublicCache } from '../src/cache/public-cache.js';
import { ContentRepository } from '../src/repositories/content-repository.js';
import { ContentService } from '../src/services/content-service.js';
const url = process.env.TEST_DATABASE_URL;
test(
  'PostgreSQL cache generations roll back atomically and archive survives Redis delivery outage',
  { skip: !url },
  async () => {
    const pool = new pg.Pool({ connectionString: url });
    const versions = new PostgresCacheVersions(pool);
    const slug = `cache-integration-${randomUUID()}`;
    let id: string | undefined;
    try {
      const store = new Map<string, string>();
      let down = false;
      const cache = new PublicCache(
        {
          async get(key) {
            if (down) throw new Error('Redis down');
            return store.get(key) ?? null;
          },
          async set(key, value) {
            if (down) throw new Error('Redis down');
            store.set(key, value);
          },
        },
        versions,
      );
      const service = new ContentService(new ContentRepository(pool), cache);
      const content = await service.create({
        title: 'Cache integration',
        slug,
        body: 'Test content',
      });
      id = content.id;
      await service.publish(id);
      assert.equal(
        (await service.findPublishedBySlug(slug)).status,
        'PUBLISHED',
      );
      const before = await versions.current('CONTENT');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          "UPDATE contents SET status='ARCHIVED' WHERE id=$1",
          [id],
        );
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
      assert.equal(await versions.current('CONTENT'), before);
      down = true;
      await service.archive(id);
      assert.notEqual(await versions.current('CONTENT'), before);
      down = false;
      await assert.rejects(
        service.findPublishedBySlug(slug),
        /Content not found/,
      );
    } finally {
      if (id) {
        await pool.query('DELETE FROM outbox_events WHERE entity_id=$1', [id]);
        await pool.query('DELETE FROM contents WHERE id=$1', [id]);
      }
      await pool.end();
    }
  },
);
