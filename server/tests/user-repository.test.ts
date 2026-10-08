import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Pool } from 'pg';
import {
  UserRepository,
  LastAdminError,
} from '../src/repositories/user-repository.js';
const id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
const row = {
  id,
  email: 'admin@example.test',
  role: 'ADMIN',
  status: 'ACTIVE',
  created_at: new Date(0),
  updated_at: new Date(0),
};
test('session query rejects expired, revoked, and disabled records in SQL', async () => {
  const repository = new UserRepository({
    async query(sql: string, values: unknown[]) {
      assert.match(sql, /s\.expires_at>now\(\)/);
      assert.match(sql, /s\.revoked_at IS NULL/);
      assert.match(sql, /u\.status='ACTIVE'/);
      assert.deepEqual(values, ['a'.repeat(64)]);
      return { rows: [] };
    },
  } as unknown as Pool);
  assert.equal(await repository.findActiveSession('a'.repeat(64)), null);
});
test('last administrator protection rolls back a disable/demotion before any access change', async () => {
  for (const patch of [
    { status: 'DISABLED' as const },
    { role: 'VIEWER' as const },
  ]) {
    const statements: string[] = [];
    let released = false;
    const client = {
      async query(sql: string) {
        statements.push(sql);
        if (sql.includes('count(*)')) return { rows: [{ total: '1' }] };
        if (sql.includes('FROM users WHERE id')) return { rows: [row] };
        return { rows: [] };
      },
      release() {
        released = true;
      },
    };
    await assert.rejects(
      new UserRepository({
        async connect() {
          return client;
        },
      } as unknown as Pool).changeAccess(id, patch),
      (error) => error instanceof LastAdminError,
    );
    assert.ok(statements.some((sql) => sql.includes('pg_advisory_xact_lock')));
    assert.equal(statements.at(-1), 'ROLLBACK');
    assert.equal(
      statements.some((sql) => sql.startsWith('UPDATE users')),
      false,
    );
    assert.equal(released, true);
  }
});
test('access changes revoke all sessions in the same transaction; repeated operations do not revoke unnecessarily', async () => {
  const statements: string[] = [];
  const client = {
    async query(sql: string, values: unknown[]) {
      statements.push(sql);
      if (sql.includes('count(*)')) return { rows: [{ total: '2' }] };
      if (sql.includes('FROM users WHERE id')) return { rows: [row] };
      if (sql.startsWith('UPDATE users')) {
        assert.deepEqual(values, [id, 'EDITOR', 'ACTIVE']);
        return { rows: [{ ...row, role: 'EDITOR' }] };
      }
      return { rows: [] };
    },
    release() {},
  };
  const repository = new UserRepository({
    async connect() {
      return client;
    },
  } as unknown as Pool);
  assert.equal(
    (await repository.changeAccess(id, { role: 'EDITOR' }))?.role,
    'EDITOR',
  );
  assert.ok(
    statements.some((sql) =>
      sql.includes('UPDATE user_sessions SET revoked_at'),
    ),
  );
  assert.equal(statements.at(-1), 'COMMIT');
  statements.length = 0;
  await repository.changeAccess(id, { role: 'ADMIN' });
  assert.equal(
    statements.some((sql) => sql.startsWith('UPDATE')),
    false,
  );
});
