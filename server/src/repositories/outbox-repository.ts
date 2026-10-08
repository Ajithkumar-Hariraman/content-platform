import type { Pool } from 'pg';
import { inTransaction } from '../database/transaction.js';
import {
  activityEventSchema,
  type ActivityEvent,
} from '../events/activity-event.js';
export interface PendingEvent {
  id: string;
  attempt: number;
  payload: unknown;
}
export type DeliveryOutcome = { ok: true } | { ok: false; error: string };
export class OutboxRepository {
  constructor(private readonly pool: Pool) {}
  async processNext(
    deliver: (pending: PendingEvent) => Promise<DeliveryOutcome>,
  ): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      return await inTransaction(client, async () => {
        const result = await client.query<{
          id: string;
          payload: unknown;
          attempt_count: number;
        }>(
          `SELECT id,payload,attempt_count FROM outbox_events WHERE processed_at IS NULL AND next_attempt_at <= clock_timestamp() ORDER BY next_attempt_at,created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`,
        );
        const row = result.rows[0];
        if (!row) return false;
        const attempt = row.attempt_count + 1;
        const outcome = await deliver({
          id: row.id,
          attempt,
          payload: row.payload,
        });
        if (outcome.ok)
          await client.query(
            `UPDATE outbox_events SET processed_at=clock_timestamp(),attempt_count=attempt_count+1,last_error=NULL WHERE id=$1`,
            [row.id],
          );
        else
          await client.query(
            `UPDATE outbox_events SET attempt_count=attempt_count+1,last_error=$2,next_attempt_at=clock_timestamp()+($3 * interval '1 millisecond') WHERE id=$1`,
            [
              row.id,
              outcome.error.slice(0, 200),
              Math.min(60000, 1000 * 2 ** Math.min(attempt - 1, 6)),
            ],
          );
        return true;
      });
    } finally {
      client.release();
    }
  }
}
export function parsePendingEvent(pending: PendingEvent): ActivityEvent {
  const event = activityEventSchema.parse(pending.payload);
  if (event.id !== pending.id) throw new Error('Outbox identity mismatch');
  return event;
}
