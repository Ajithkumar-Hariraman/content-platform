import { readPoolConfig } from '../config/performance.js';
import { instrumentClient } from './query-timing.js';
import { redact } from '../logging/redact.js';
import pg, { type PoolConfig } from 'pg';

export function createDatabase(
  connection: string | PoolConfig,
  configuration = readPoolConfig(process.env),
) {
  const pool = new pg.Pool({
    ...(typeof connection === 'string'
      ? { connectionString: connection }
      : connection),
    ...configuration,
    statement_timeout: 5000,
  });
  pool.on('connect', instrumentClient);
  pool.on('error', (error) => {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'database_pool_error',
        message: redact(error.message),
      }),
    );
  });
  return {
    pool,
    statistics() {
      return {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
        max: configuration.max,
      };
    },
    async checkConnection(): Promise<void> {
      await pool.query('SELECT 1');
    },
    async close(): Promise<void> {
      await pool.end();
    },
  };
}
