import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import { inTransaction } from './transaction.js';

export async function runMigrations(pool: Pool): Promise<void> {
  const directory = new URL('../../migrations/', import.meta.url);
  const files = (await readdir(directory))
    .filter((file) => /^\d+_[a-z0-9_]+\.sql$/.test(file))
    .sort();
  const client = await pool.connect();
  let locked = false;
  try {
    await client.query('SELECT pg_advisory_lock($1)', [72421002]);
    locked = true;
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const applied = await client.query<{ name: string; checksum: string }>(
      'SELECT name, checksum FROM schema_migrations ORDER BY name',
    );
    const checksums = new Map(
      applied.rows.map((row) => [row.name, row.checksum]),
    );
    for (const name of checksums.keys())
      if (!files.includes(name))
        throw new Error(`Applied migration is missing: ${name}`);
    const latestApplied = applied.rows.at(-1)?.name;
    for (const name of files) {
      const sql = await readFile(new URL(name, directory), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      if (checksums.has(name)) {
        if (checksums.get(name) !== checksum)
          throw new Error(`Applied migration was modified: ${name}`);
        continue;
      }
      if (latestApplied && name < latestApplied)
        throw new Error(`Migration is out of order: ${name}`);
      await inTransaction(client, async () => {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)',
          [name, checksum],
        );
      });
      console.log(
        JSON.stringify({ level: 'info', event: 'migration_applied', name }),
      );
    }
  } finally {
    try {
      if (locked)
        await client.query('SELECT pg_advisory_unlock($1)', [72421002]);
    } finally {
      client.release();
    }
  }
}
