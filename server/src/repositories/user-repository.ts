import type { Pool } from 'pg';
import { inTransaction } from '../database/transaction.js';
import type {
  User,
  CredentialUser,
  Role,
  UserStatus,
  Principal,
} from '../auth/types.js';
export class UserConflict extends Error {}
export class LastAdminError extends Error {}
interface UserRow {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
  password_hash?: string;
  session_id?: string;
  csrf_token_hash?: string;
}
const columns = 'id,email,role,status,created_at,updated_at';
function map(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
export class UserRepository {
  constructor(private readonly pool: Pool) {}
  async findCredentials(email: string): Promise<CredentialUser | null> {
    const row = (
      await this.pool.query<UserRow>(
        `SELECT ${columns},password_hash FROM users WHERE email=$1`,
        [email],
      )
    ).rows[0];
    return row && row.password_hash
      ? { ...map(row), passwordHash: row.password_hash }
      : null;
  }
  async findActiveSession(tokenHash: string): Promise<Principal | null> {
    const result = await this.pool.query<UserRow>(
      `WITH active AS (UPDATE user_sessions s SET last_seen_at=CASE WHEN s.last_seen_at < now()-interval '5 minutes' THEN now() ELSE s.last_seen_at END FROM users u WHERE s.token_hash=$1 AND s.user_id=u.id AND s.revoked_at IS NULL AND s.expires_at>now() AND u.status='ACTIVE' RETURNING s.id,s.user_id,s.csrf_token_hash) SELECT u.id,u.email,u.role,u.status,u.created_at,u.updated_at,a.id AS session_id,a.csrf_token_hash FROM active a JOIN users u ON u.id=a.user_id`,
      [tokenHash],
    );
    const row = result.rows[0];
    return row?.session_id && row.csrf_token_hash
      ? {
          user: map(row),
          sessionId: row.session_id,
          csrfTokenHash: row.csrf_token_hash,
        }
      : null;
  }
  async createSession(
    userId: string,
    passwordHash: string,
    tokenHash: string,
    csrfHash: string,
    expiresAt: Date,
    oldTokenHash?: string,
  ): Promise<string | null> {
    const client = await this.pool.connect();
    try {
      return await inTransaction(client, async () => {
        const user = await client.query(
          "SELECT id FROM users WHERE id=$1 AND status='ACTIVE' AND password_hash=$2 FOR UPDATE",
          [userId, passwordHash],
        );
        if (!user.rows.length) return null;
        if (oldTokenHash)
          await client.query(
            'UPDATE user_sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL',
            [oldTokenHash],
          );
        const session = await client.query<{ id: string }>(
          'INSERT INTO user_sessions (user_id,token_hash,csrf_token_hash,expires_at) VALUES ($1,$2,$3,$4) RETURNING id',
          [userId, tokenHash, csrfHash, expiresAt],
        );
        return session.rows[0]?.id ?? null;
      });
    } finally {
      client.release();
    }
  }
  async revokeSession(id: string): Promise<void> {
    await this.pool.query(
      'UPDATE user_sessions SET revoked_at=now() WHERE id=$1 AND revoked_at IS NULL',
      [id],
    );
  }
  async changePassword(
    userId: string,
    expectedHash: string,
    newHash: string,
  ): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      return await inTransaction(client, async () => {
        const updated = await client.query(
          "UPDATE users SET password_hash=$3,updated_at=clock_timestamp() WHERE id=$1 AND password_hash=$2 AND status='ACTIVE' RETURNING id",
          [userId, expectedHash, newHash],
        );
        if (!updated.rows.length) return false;
        await client.query(
          'UPDATE user_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',
          [userId],
        );
        return true;
      });
    } finally {
      client.release();
    }
  }
  async list(
    page: number,
    limit: number,
  ): Promise<{ data: User[]; total: number }> {
    const result = await this.pool.query<{ total: string; items: UserRow[] }>(
      `WITH filtered AS (SELECT ${columns} FROM users), page AS (SELECT ${columns} FROM filtered ORDER BY created_at DESC,id ASC LIMIT $1 OFFSET $2) SELECT (SELECT count(*)::text FROM filtered) AS total,COALESCE((SELECT jsonb_agg(page ORDER BY created_at DESC,id ASC) FROM page),'[]'::jsonb) AS items`,
      [limit, (page - 1) * limit],
    );
    const row = result.rows[0];
    if (!row) throw new Error('User list returned no result');
    return { data: row.items.map(map), total: Number(row.total) };
  }
  async create(email: string, passwordHash: string, role: Role): Promise<User> {
    try {
      const row = (
        await this.pool.query<UserRow>(
          `INSERT INTO users (email,password_hash,role) VALUES ($1,$2,$3) RETURNING ${columns}`,
          [email, passwordHash, role],
        )
      ).rows[0];
      if (!row) throw new Error('User creation returned no result');
      return map(row);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === '23505'
      )
        throw new UserConflict();
      throw error;
    }
  }
  async changeAccess(
    id: string,
    patch: { role?: Role; status?: UserStatus },
  ): Promise<User | null> {
    const client = await this.pool.connect();
    try {
      return await inTransaction(client, async () => {
        await client.query('SELECT pg_advisory_xact_lock($1)', [72421003]);
        const current = (
          await client.query<UserRow>(
            `SELECT ${columns} FROM users WHERE id=$1 FOR UPDATE`,
            [id],
          )
        ).rows[0];
        if (!current) return null;
        const role = patch.role ?? current.role;
        const status = patch.status ?? current.status;
        if (
          current.role === 'ADMIN' &&
          current.status === 'ACTIVE' &&
          (role !== 'ADMIN' || status !== 'ACTIVE')
        ) {
          const count = await client.query<{ total: string }>(
            "SELECT count(*)::text AS total FROM users WHERE role='ADMIN' AND status='ACTIVE'",
          );
          if (Number(count.rows[0]?.total) <= 1) throw new LastAdminError();
        }
        if (role === current.role && status === current.status)
          return map(current);
        const updated = (
          await client.query<UserRow>(
            `UPDATE users SET role=$2,status=$3,updated_at=clock_timestamp() WHERE id=$1 RETURNING ${columns}`,
            [id, role, status],
          )
        ).rows[0];
        await client.query(
          'UPDATE user_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',
          [id],
        );
        return updated ? map(updated) : null;
      });
    } finally {
      client.release();
    }
  }
}
