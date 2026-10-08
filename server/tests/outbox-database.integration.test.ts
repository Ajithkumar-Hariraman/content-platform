import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createDatabase } from '../src/database/pool.js';
import { runMigrations } from '../src/database/migrations.js';
import { withOutbox } from '../src/database/outbox-transaction.js';
import { activityEvent } from '../src/events/activity-event.js';
import { ContentRepository } from '../src/repositories/content-repository.js';
import { ContentService } from '../src/services/content-service.js';
import { OutboxRepository } from '../src/repositories/outbox-repository.js';
test(
  'PostgreSQL outbox commits mutations atomically and preserves pending delivery failures',
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const database = createDatabase(process.env.TEST_DATABASE_URL!);
    const ids: string[] = [];
    const prefix = `outbox-${randomUUID()}`;
    try {
      await runMigrations(database.pool);
      const service = new ContentService(new ContentRepository(database.pool));
      const content = await service.create({
        title: prefix,
        slug: prefix,
        body: 'Body',
      });
      ids.push(content.id);
      const events = await database.pool.query<{
        id: string;
        event_type: string;
        processed_at: Date | null;
      }>(
        'SELECT id,event_type,processed_at FROM outbox_events WHERE entity_id=$1',
        [content.id],
      );
      assert.equal(events.rows.length, 1);
      assert.equal(events.rows[0]?.event_type, 'CONTENT_CREATED');
      assert.equal(events.rows[0]?.processed_at, null);
      await assert.rejects(
        service.create({ title: prefix, slug: prefix, body: 'Duplicate' }),
      );
      assert.equal(
        (
          await database.pool.query(
            'SELECT id FROM outbox_events WHERE entity_id=$1',
            [content.id],
          )
        ).rows.length,
        1,
      );
      await service.publish(content.id);
      await service.publish(content.id);
      await service.archive(content.id);
      await service.archive(content.id);
      assert.equal(
        (
          await database.pool.query(
            'SELECT id FROM outbox_events WHERE entity_id=$1',
            [content.id],
          )
        ).rows.length,
        3,
      );
      const duplicateEvent = activityEvent(
        'CONTENT_CREATED',
        'CONTENT',
        content.id,
      );
      duplicateEvent.id = events.rows[0]!.id;
      const rollbackId = randomUUID();
      ids.push(rollbackId);
      await assert.rejects(
        withOutbox(database.pool, async (client) => {
          await client.query(
            'INSERT INTO contents (id,title,slug,body) VALUES ($1,$2,$3,$4)',
            [rollbackId, prefix, `${prefix}-rollback`, 'Body'],
          );
          return { result: rollbackId, event: duplicateEvent };
        }),
      );
      assert.equal(
        (
          await database.pool.query('SELECT id FROM contents WHERE id=$1', [
            rollbackId,
          ])
        ).rows.length,
        0,
      );
      await database.pool.query(
        "UPDATE outbox_events SET next_attempt_at=clock_timestamp()-interval '1 day' WHERE id=$1",
        [events.rows[0]!.id],
      );
      const outbox = new OutboxRepository(database.pool);
      await outbox.processNext(async (pending) => {
        assert.equal(pending.id, events.rows[0]!.id);
        return { ok: false, error: 'Unavailable' };
      });
      const failed = await database.pool.query(
        'SELECT processed_at,attempt_count,last_error FROM outbox_events WHERE id=$1',
        [events.rows[0]!.id],
      );
      assert.equal(failed.rows[0]?.processed_at, null);
      assert.equal(failed.rows[0]?.attempt_count, 1);
      assert.equal(failed.rows[0]?.last_error, 'Unavailable');
      await database.pool.query(
        "UPDATE outbox_events SET next_attempt_at=clock_timestamp()-interval '2 days' WHERE id=$1",
        [events.rows[0]!.id],
      );
      await outbox.processNext(async (pending) => {
        assert.equal(pending.id, events.rows[0]!.id);
        return { ok: true };
      });
      assert.ok(
        (
          await database.pool.query(
            'SELECT processed_at FROM outbox_events WHERE id=$1',
            [events.rows[0]!.id],
          )
        ).rows[0]?.processed_at,
      );
    } finally {
      try {
        await database.pool.query(
          'DELETE FROM outbox_events WHERE entity_id=ANY($1::uuid[])',
          [ids],
        );
        await database.pool.query(
          'DELETE FROM contents WHERE id=ANY($1::uuid[])',
          [ids],
        );
      } finally {
        await database.close();
      }
    }
  },
);
