import { shutdownTracing } from '../observability/tracing.js';
import { startMetricsServer } from '../observability/metrics-server.js';
import { setTimeout } from 'node:timers/promises';
import { readConfig } from '../config/env.js';
import { readEventConfig } from '../config/events.js';
import { createDatabase } from '../database/pool.js';
import { createActivityDatabase } from '../dynamodb/client.js';
import { ActivityRepository } from '../repositories/activity-repository.js';
import { OutboxRepository } from '../repositories/outbox-repository.js';
import { OutboxWorker } from './outbox-worker.js';
const metricsServer = startMetricsServer();
const config = readConfig(process.env);
if (!config.database)
  throw new Error('Database configuration is required for the outbox worker');
const events = readEventConfig(process.env);
const database = createDatabase(config.database);
const activity = createActivityDatabase(events);
const controller = new AbortController();
function shutdown(signal: string) {
  if (controller.signal.aborted) return;
  console.log(
    JSON.stringify({ level: 'info', event: 'worker_shutdown_started', signal }),
  );
  controller.abort();
}
const onTerm = () => shutdown('SIGTERM');
const onInt = () => shutdown('SIGINT');
process.on('SIGTERM', onTerm);
process.on('SIGINT', onInt);
const worker = new OutboxWorker(
  new OutboxRepository(database.pool),
  new ActivityRepository(activity.documentClient, events.table),
  events.batchSize,
);
console.log(
  JSON.stringify({
    level: 'info',
    event: 'worker_started',
    batchSize: events.batchSize,
    pollIntervalMs: events.pollIntervalMs,
  }),
);
try {
  while (!controller.signal.aborted) {
    try {
      await worker.runBatch(controller.signal);
    } catch {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'worker_poll_failed',
          dependency: 'postgres',
        }),
      );
    }
    if (!controller.signal.aborted)
      try {
        await setTimeout(events.pollIntervalMs, undefined, {
          signal: controller.signal,
        });
      } catch {
        if (!controller.signal.aborted)
          throw new Error('Worker polling timer failed');
      }
  }
} finally {
  metricsServer?.close();
  activity.close();
  await database.close();
  await shutdownTracing();
  process.removeListener('SIGTERM', onTerm);
  process.removeListener('SIGINT', onInt);
  console.log(
    JSON.stringify({ level: 'info', event: 'worker_shutdown_completed' }),
  );
}
