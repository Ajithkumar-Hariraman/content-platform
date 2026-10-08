import type { Pool } from 'pg';
export function transactionPool(pool: Pool): Pool {
  return Object.assign(pool, {
    async connect() {
      return {
        async query(sql: string, values?: unknown[]) {
          if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql))
            return { rows: [] };
          return pool.query(sql, values);
        },
        release() {},
      };
    },
  }) as unknown as Pool;
}
