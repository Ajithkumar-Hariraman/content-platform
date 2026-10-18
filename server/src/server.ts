import { shutdownTracing } from './observability/tracing.js';
import { startMetricsServer } from './observability/metrics-server.js';
import { readPerformanceConfig } from './config/performance.js';
import { createRedisCache } from './cache/redis.js';
import { PublicCache } from './cache/public-cache.js';
import { PostgresCacheVersions } from './cache/versions.js';
import { readSecurityConfig } from './config/security.js';
import { UserRepository } from './repositories/user-repository.js';
import { AuthService } from './services/auth-service.js';
import { UserService } from './services/user-service.js';
import { readEventConfig } from './config/events.js';
import { createActivityDatabase } from './dynamodb/client.js';
import { ActivityRepository } from './repositories/activity-repository.js';
import { ActivityService } from './services/activity-service.js';
import { redact } from './logging/redact.js';
import { ContentRepository } from './repositories/content-repository.js';
import { ContentService } from './services/content-service.js';
import { createServer } from 'node:http';
import { createCatalog } from './services/catalog.js';
import { createApp } from './app.js';
import { readConfig } from './config/env.js';
import { createDatabase } from './database/pool.js';

const metricsServer = startMetricsServer();
const config = readConfig(process.env);
const database = config.database ? createDatabase(config.database) : undefined;
const performanceConfig = readPerformanceConfig(process.env);
const redis =
  performanceConfig.cacheEnabled && performanceConfig.redisUrl
    ? createRedisCache(
        performanceConfig.redisUrl,
        performanceConfig.cacheTimeoutMs,
      )
    : undefined;
const publicCache =
  redis && database
    ? new PublicCache(
        redis.store,
        new PostgresCacheVersions(database.pool),
        performanceConfig.ttlSeconds,
      )
    : undefined;
const security = readSecurityConfig(process.env);
const users = database ? new UserRepository(database.pool) : undefined;
const eventConfig = readEventConfig(process.env);
const activity = createActivityDatabase(eventConfig);
const server = createServer(
  createApp(
    config,
    database ? createCatalog(database.pool, publicCache) : undefined,
    database
      ? new ContentService(new ContentRepository(database.pool), publicCache)
      : undefined,
    database?.checkConnection,
    new ActivityService(
      new ActivityRepository(activity.documentClient, eventConfig.table),
    ),
    users ? new AuthService(users, security.sessionLifetimeMs) : undefined,
    users ? new UserService(users) : undefined,
    security,
    database?.statistics,
  ),
).listen(config.port, () => {
  console.log(
    JSON.stringify({
      level: 'info',
      event: 'server_started',
      port: config.port,
    }),
  );
});
server.on('error', (error) => {
  activity.close();
  redis?.close();
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'server_error',
      message: redact(error.message),
    }),
  );
  void database
    ?.close()
    .catch((cleanupError: unknown) => console.error(cleanupError))
    .finally(() => process.exit(1));
  if (!database) process.exit(1);
});

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  metricsServer?.close();
  console.log(
    JSON.stringify({ level: 'info', event: 'shutdown_started', signal }),
  );
  const deadline = setTimeout(() => {
    console.error(
      JSON.stringify({ level: 'error', event: 'shutdown_timeout' }),
    );
    server.closeAllConnections();
    process.exit(1);
  }, 10000);
  deadline.unref();
  server.close((error) => {
    void (async () => {
      try {
        if (error) throw error;
        await database?.close();
        await shutdownTracing();
        activity.close();
        redis?.close();
        clearTimeout(deadline);
        console.log(
          JSON.stringify({ level: 'info', event: 'shutdown_completed' }),
        );
      } catch (shutdownError) {
        console.error(
          JSON.stringify({
            level: 'error',
            event: 'shutdown_failed',
            message:
              shutdownError instanceof Error
                ? redact(shutdownError.message)
                : String(shutdownError),
          }),
        );
        process.exitCode = 1;
      }
    })();
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
