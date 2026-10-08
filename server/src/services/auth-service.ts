import type { UserRepository } from '../repositories/user-repository.js';
import type { User, Principal } from '../auth/types.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { hashToken, randomToken } from '../auth/tokens.js';
import { rolePermissions } from '../auth/permissions.js';
import { AppError } from '../errors/app-error.js';
export class AuthService {
  constructor(
    private readonly users: Pick<
      UserRepository,
      | 'findCredentials'
      | 'findActiveSession'
      | 'createSession'
      | 'revokeSession'
      | 'changePassword'
    >,
    private readonly lifetimeMs: number,
  ) {}
  async login(email: string, password: string, oldToken?: string) {
    const user = await this.users.findCredentials(email);
    const valid = await verifyPassword(password, user?.passwordHash ?? null);
    if (!valid || !user || user.status !== 'ACTIVE')
      throw new AppError(
        401,
        'INVALID_CREDENTIALS',
        'Invalid email or password',
      );
    const token = randomToken();
    const csrfToken = randomToken();
    const expiresAt = new Date(Date.now() + this.lifetimeMs);
    const sessionId = await this.users.createSession(
      user.id,
      user.passwordHash,
      hashToken(token),
      hashToken(csrfToken),
      expiresAt,
      oldToken ? hashToken(oldToken) : undefined,
    );
    if (!sessionId)
      throw new AppError(
        401,
        'INVALID_CREDENTIALS',
        'Invalid email or password',
      );
    const publicUser: User = {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    return {
      user: publicUser,
      permissions: rolePermissions[user.role],
      token,
      csrfToken,
      expiresAt,
    };
  }
  async authenticate(token: string): Promise<Principal> {
    const principal = await this.users.findActiveSession(hashToken(token));
    if (!principal)
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    return principal;
  }
  async logout(principal: Principal): Promise<void> {
    await this.users.revokeSession(principal.sessionId);
  }
  async changePassword(
    principal: Principal,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.users.findCredentials(principal.user.email);
    const valid = await verifyPassword(
      currentPassword,
      user?.passwordHash ?? null,
    );
    if (
      !valid ||
      !user ||
      user.status !== 'ACTIVE' ||
      user.id !== principal.user.id
    )
      throw new AppError(
        400,
        'INVALID_PASSWORD',
        'Current password is incorrect',
      );
    const hash = await hashPassword(newPassword);
    if (!(await this.users.changePassword(user.id, user.passwordHash, hash)))
      throw new AppError(
        409,
        'AUTH_STATE_CHANGED',
        'Authentication state changed; sign in again',
      );
  }
  publicSession(user: User, csrfToken: string) {
    return { user, permissions: rolePermissions[user.role], csrfToken };
  }
}
