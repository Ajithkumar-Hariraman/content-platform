import { parseAuth, emailSchema, passwordSchema } from '../validation/auth.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { readFile } from 'node:fs/promises';
import { withDatabase } from './cli.js';
import { inTransaction } from './transaction.js';
await withDatabase(async ({ pool }) => {
  if (!process.env.DEV_ADMIN_EMAIL || !process.env.DEV_ADMIN_PASSWORD)
    throw new Error(
      'Set DEV_ADMIN_EMAIL and DEV_ADMIN_PASSWORD (12–128 characters) before development seeding',
    );
  const sql = await readFile(
    new URL('../../seeds/development.sql', import.meta.url),
    'utf8',
  );
  const client = await pool.connect();
  try {
    await inTransaction(client, async () => {
      const email = parseAuth(emailSchema, process.env.DEV_ADMIN_EMAIL);
      const password = parseAuth(
        passwordSchema,
        process.env.DEV_ADMIN_PASSWORD,
      );
      const existing = await client.query<{
        id: string;
        password_hash: string;
        role: string;
        status: string;
      }>(
        'SELECT id,password_hash,role,status FROM users WHERE email=$1 FOR UPDATE',
        [email],
      );
      const user = existing.rows[0];
      if (user && (user.role !== 'ADMIN' || user.status !== 'ACTIVE'))
        throw new Error(
          'Development administrator email belongs to a non-active administrator; resolve explicitly before seeding',
        );
      if (!user)
        await client.query(
          "INSERT INTO users (id,email,password_hash,role) VALUES ($1,$2,$3,'ADMIN')",
          [
            'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
            email,
            await hashPassword(password),
          ],
        );
      else if (!(await verifyPassword(password, user.password_hash))) {
        await client.query(
          'UPDATE users SET password_hash=$2,updated_at=clock_timestamp() WHERE id=$1',
          [user.id, await hashPassword(password)],
        );
        await client.query(
          'UPDATE user_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',
          [user.id],
        );
      }
      await client.query(sql);
    });
  } finally {
    client.release();
  }
  console.log(
    JSON.stringify({ level: 'info', event: 'development_seed_completed' }),
  );
}, true);
