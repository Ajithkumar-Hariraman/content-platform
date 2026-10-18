import type { PoolClient } from 'pg';
import { metrics } from '../metrics/registry.js';
export function instrumentClient(client: PoolClient) {
  const original = client.query.bind(client);
  client.query = ((...args: unknown[]) => {
    const start = performance.now();
    const sql = typeof args[0] === 'string' ? args[0] : '';
    const verb = sql.trim().split(/\s+/)[0]?.toUpperCase() ?? '';
    const operation = [
      'SELECT',
      'WITH',
      'INSERT',
      'UPDATE',
      'DELETE',
      'BEGIN',
      'COMMIT',
      'ROLLBACK',
    ].includes(verb)
      ? verb
      : 'OTHER';
    let recorded = false;
    const finish = () => {
      if (!recorded) {
        recorded = true;
        const duration = performance.now() - start;
        const threshold = Number(process.env.SLOW_QUERY_THRESHOLD_MS ?? 250);
        if (duration >= threshold)
          metrics.increment('database_slow_queries_total');
        metrics.observe(`database_query_duration_ms:${operation}`, duration);
      }
    };
    const callback = args.at(-1);
    if (typeof callback === 'function')
      args[args.length - 1] = (...values: unknown[]) => {
        finish();
        return Reflect.apply(callback, undefined, values);
      };
    try {
      const result: unknown = Reflect.apply(original, client, args);
      if (result instanceof Promise) return result.finally(finish);
      return result;
    } catch (error) {
      finish();
      throw error;
    }
  }) as typeof client.query;
}
