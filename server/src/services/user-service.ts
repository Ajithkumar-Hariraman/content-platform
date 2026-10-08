import type { UserRepository } from '../repositories/user-repository.js';
import {
  LastAdminError,
  UserConflict,
} from '../repositories/user-repository.js';
import { hashPassword } from '../auth/password.js';
import type { Role, UserStatus } from '../auth/types.js';
import { AppError } from '../errors/app-error.js';
export class UserService {
  constructor(
    private readonly repository: Pick<
      UserRepository,
      'list' | 'create' | 'changeAccess'
    >,
  ) {}
  async list(page: number, limit: number) {
    const result = await this.repository.list(page, limit);
    return {
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }
  async create(input: { email: string; password: string; role: Role }) {
    const hash = await hashPassword(input.password);
    try {
      return await this.repository.create(input.email, hash, input.role);
    } catch (error) {
      if (error instanceof UserConflict)
        throw new AppError(
          409,
          'DUPLICATE_EMAIL',
          'A user with this email already exists',
        );
      throw error;
    }
  }
  async changeAccess(id: string, patch: { role?: Role; status?: UserStatus }) {
    try {
      const user = await this.repository.changeAccess(id, patch);
      if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
      return user;
    } catch (error) {
      if (error instanceof LastAdminError)
        throw new AppError(
          409,
          'LAST_ADMIN',
          'The last active administrator cannot be disabled or demoted',
        );
      throw error;
    }
  }
}
