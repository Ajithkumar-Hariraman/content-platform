import type { OutboxRepository } from '../repositories/outbox-repository.js';
import { parsePendingEvent } from '../repositories/outbox-repository.js';
import type { ActivityRepository } from '../repositories/activity-repository.js';
export class OutboxWorker {
  constructor(
    private readonly outbox: Pick<OutboxRepository, 'processNext'>,
    private readonly activity: Pick<ActivityRepository, 'put'>,
    private readonly batchSize: number,
  ) {}
  async runBatch(signal: AbortSignal): Promise<number> {
    let processed = 0;
    while (processed < this.batchSize && !signal.aborted) {
      const found = await this.outbox.processNext(async (pending) => {
        const start = performance.now();
        let eventType = 'UNKNOWN';
        try {
          const event = parsePendingEvent(pending);
          eventType = event.eventType;
          await this.activity.put(event, signal);
          console.log(
            JSON.stringify({
              level: 'info',
              event: 'outbox_delivered',
              outboxEventId: pending.id,
              eventType,
              attempt: pending.attempt,
              durationMs: Math.round(performance.now() - start),
            }),
          );
          return { ok: true };
        } catch (error) {
          const name =
            error instanceof Error &&
            /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(error.name)
              ? error.name
              : 'DELIVERY_FAILED';
          console.error(
            JSON.stringify({
              level: 'error',
              event: 'outbox_delivery_failed',
              outboxEventId: pending.id,
              eventType,
              attempt: pending.attempt,
              durationMs: Math.round(performance.now() - start),
              error: name,
            }),
          );
          return { ok: false, error: name };
        }
      });
      if (!found) break;
      processed++;
    }
    return processed;
  }
}
