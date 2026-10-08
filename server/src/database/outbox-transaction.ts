import type { Pool, PoolClient } from 'pg';
import { inTransaction } from './transaction.js';
import type { ActivityEvent } from '../events/activity-event.js';
export async function withOutbox<T>(
  pool: Pool,
  operation: (
    client: PoolClient,
  ) => Promise<{ result: T; event: ActivityEvent | null }>,
): Promise<T> {
  const client = await pool.connect();
  try {
    return await inTransaction(client, async () => {
      const { result, event } = await operation(client);
      if (event)
        await client.query(
          `INSERT INTO outbox_events (id,event_type,entity_type,entity_id,payload,created_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
          [
            event.id,
            event.eventType,
            event.entityType,
            event.entityId,
            JSON.stringify(event),
            event.occurredAt,
          ],
        );
      return result;
    });
  } finally {
    client.release();
  }
}
