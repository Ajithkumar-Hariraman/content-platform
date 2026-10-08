import { randomUUID } from 'node:crypto';
import type { CredentialUser, Principal } from '../src/auth/types.js';
import { AuthService } from '../src/services/auth-service.js';
import { hashPassword } from '../src/auth/password.js';
let passwordHash: Promise<string> | undefined;
export const password = 'test-only-password-129';
export async function authFixture() {
  const hash = await (passwordHash ??= hashPassword(password));
  let user: CredentialUser = {
    id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    email: 'admin@example.test',
    role: 'ADMIN',
    status: 'ACTIVE',
    passwordHash: hash,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const sessions = new Map<
    string,
    { id: string; csrf: string; expires: Date; revoked: boolean }
  >();
  const repository: ConstructorParameters<typeof AuthService>[0] = {
    async findCredentials(email) {
      return email === user.email ? user : null;
    },
    async createSession(userId, expected, tokenHash, csrf, expires, old) {
      if (
        userId !== user.id ||
        expected !== user.passwordHash ||
        user.status !== 'ACTIVE'
      )
        return null;
      if (old) {
        const previous = sessions.get(old);
        if (previous) previous.revoked = true;
      }
      const id = randomUUID();
      sessions.set(tokenHash, { id, csrf, expires, revoked: false });
      return id;
    },
    async findActiveSession(tokenHash) {
      const session = sessions.get(tokenHash);
      if (
        !session ||
        session.revoked ||
        session.expires.getTime() <= Date.now() ||
        user.status !== 'ACTIVE'
      )
        return null;
      const safe = {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
      return { user: safe, sessionId: session.id, csrfTokenHash: session.csrf };
    },
    async revokeSession(id) {
      for (const session of sessions.values())
        if (session.id === id) session.revoked = true;
    },
    async changePassword(id, expected, newHash) {
      if (id !== user.id || user.passwordHash !== expected) return false;
      user = { ...user, passwordHash: newHash };
      for (const session of sessions.values()) session.revoked = true;
      return true;
    },
  };
  return {
    service: new AuthService(repository, 3600000),
    repository,
    sessions,
    user: () => user,
    setUser: (patch: Partial<CredentialUser>) => {
      user = { ...user, ...patch };
    },
  };
}
export const principal = (
  role: Principal['user']['role'] = 'ADMIN',
): Principal => ({
  user: {
    id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    email: 'admin@example.test',
    role,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  sessionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
  csrfTokenHash: 'a'.repeat(64),
});
