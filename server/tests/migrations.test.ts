import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Pool } from 'pg';
import { runMigrations } from '../src/database/migrations.js';

function migrationPool(
  applied: { name: string; checksum: string }[] = [],
  failMigration = false,
) {
  const statements: string[] = [];
  let released = 0;
  const client = {
    async query(sql: string, values?: string[]) {
      statements.push(sql);
      if (sql.startsWith('SELECT name, checksum')) return { rows: applied };
      if (sql.startsWith('INSERT INTO schema_migrations')) {
        applied.push({
          name: String(values?.[0]),
          checksum: String(values?.[1]),
        });
      }
      if (failMigration && sql.startsWith('CREATE TABLE categories'))
        throw new Error('migration failed');
      return { rows: [] };
    },
    release() {
      released++;
    },
  };
  const pool = {
    async connect() {
      return client;
    },
  } as unknown as Pool;
  return { pool, statements, applied, releases: () => released };
}

test('migration runner applies once, records checksum, and releases its lock/client', async () => {
  const fixture = migrationPool();
  await runMigrations(fixture.pool);
  assert.equal(fixture.applied.length, 5);
  assert.match(fixture.applied[0]?.checksum ?? '', /^[a-f0-9]{64}$/);
  assert.ok(fixture.statements.includes('BEGIN'));
  assert.ok(fixture.statements.includes('COMMIT'));
  await runMigrations(fixture.pool);
  assert.equal(fixture.statements.filter((sql) => sql === 'BEGIN').length, 5);
  assert.equal(
    fixture.statements.filter((sql) => sql.includes('pg_advisory_unlock'))
      .length,
    2,
  );
  assert.equal(fixture.releases(), 2);
});

test('migration runner rejects altered or missing applied migrations', async () => {
  for (const name of ['001_catalog.sql', '000_missing.sql']) {
    const fixture = migrationPool([{ name, checksum: 'altered' }]);
    await assert.rejects(runMigrations(fixture.pool), /Applied migration/);
    assert.equal(fixture.releases(), 1);
    assert.ok(
      fixture.statements.some((sql) => sql.includes('pg_advisory_unlock')),
    );
    assert.equal(fixture.statements.includes('BEGIN'), false);
  }
});

test('failed migration rolls back without recording success', async () => {
  const fixture = migrationPool([], true);
  await assert.rejects(runMigrations(fixture.pool), /migration failed/);
  assert.ok(fixture.statements.includes('ROLLBACK'));
  assert.equal(fixture.applied.length, 0);
  assert.equal(fixture.releases(), 1);
});
