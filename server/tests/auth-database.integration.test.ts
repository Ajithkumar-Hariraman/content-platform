import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createDatabase } from '../src/database/pool.js';
import { runMigrations } from '../src/database/migrations.js';
import { UserRepository } from '../src/repositories/user-repository.js';
import { AuthService } from '../src/services/auth-service.js';
import { hashPassword } from '../src/auth/password.js';
import { hashToken } from '../src/auth/tokens.js';
test(
  'PostgreSQL sessions enforce expiry, revocation, disabled users and password rotation',
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const database = createDatabase(process.env.TEST_DATABASE_URL!);
    const email = `auth-${randomUUID()}@example.test`;
    let userId: string | undefined;
    try {
      await runMigrations(database.pool);
      const users = new UserRepository(database.pool);
      const user = await users.create(
        email,
        await hashPassword('test-integration-password-294'),
        'VIEWER',
      );
      userId = user.id;
      const service = new AuthService(users, 3600000);
      const first = await service.login(email, 'test-integration-password-294');
      const stored = await database.pool.query(
        'SELECT token_hash,csrf_token_hash FROM user_sessions WHERE user_id=$1',
        [user.id],
      );
      assert.equal(stored.rows[0]?.token_hash, hashToken(first.token));
      assert.equal(stored.rows[0]?.csrf_token_hash, hashToken(first.csrfToken));
      const principal = await service.authenticate(first.token);
      await service.logout(principal);
      await assert.rejects(service.authenticate(first.token));
      const second = await service.login(
        email,
        'test-integration-password-294',
      );
      await database.pool.query(
        "UPDATE user_sessions SET expires_at=now()-interval '1 second',created_at=now()-interval '1 hour' WHERE token_hash=$1",
        [hashToken(second.token)],
      );
      await assert.rejects(service.authenticate(second.token));
      const third = await service.login(email, 'test-integration-password-294');
      await users.changeAccess(user.id, { status: 'DISABLED' });
      await assert.rejects(service.authenticate(third.token));
      await users.changeAccess(user.id, { status: 'ACTIVE' });
      const fourth = await service.login(
        email,
        'test-integration-password-294',
      );
      await service.changePassword(
        await service.authenticate(fourth.token),
        'test-integration-password-294',
        'changed-integration-password-194',
      );
      await assert.rejects(service.authenticate(fourth.token));
      await assert.rejects(
        service.login(email, 'test-integration-password-294'),
      );
      assert.ok(
        (await service.login(email, 'changed-integration-password-194')).token,
      );
    } finally {
      try {
        if (userId)
          await database.pool.query('DELETE FROM users WHERE id=$1', [userId]);
      } finally {
        await database.close();
      }
    }
  },
);
