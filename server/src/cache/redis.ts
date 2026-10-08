import { createClient } from 'redis';
import type { CacheStore } from './public-cache.js';
export function createRedisCache(url: string, timeoutMs: number) {
  const client = createClient({
    url,
    disableOfflineQueue: true,
    commandsQueueMaxLength: 1024,
    socket: {
      connectTimeout: 1000,
      reconnectStrategy: (retries: number) =>
        Math.min(1000 * (retries + 1), 10000),
    },
  });
  let lastLog = 0;
  client.on('error', () => {
    if (Date.now() - lastLog > 10000) {
      lastLog = Date.now();
      console.warn(
        JSON.stringify({ level: 'warn', event: 'redis_connection_error' }),
      );
    }
  });
  void client.connect().catch(() => {});
  function connection() {
    if (!client.isReady) throw new Error('Redis unavailable');
    return client.withCommandOptions({
      abortSignal: AbortSignal.timeout(timeoutMs),
    });
  }
  const store: CacheStore = {
    async get(key) {
      return connection().get(key);
    },
    async set(key, value, ttlSeconds) {
      await connection().set(key, value, { EX: ttlSeconds });
    },
  };
  return {
    store,
    close() {
      if (client.isOpen) client.destroy();
    },
  };
}
