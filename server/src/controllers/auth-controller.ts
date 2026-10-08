import type { RequestHandler } from 'express';
import type { AuthService } from '../services/auth-service.js';
import type { SecurityConfig } from '../config/security.js';
import { parseLogin, parsePasswordChange } from '../validation/auth.js';
import {
  cookieNames,
  readCookie,
  setAuthCookies,
  clearAuthCookies,
} from '../auth/cookies.js';
import { tokenMatches } from '../auth/tokens.js';
import { AppError } from '../errors/app-error.js';
export class AuthController {
  constructor(
    private readonly service: AuthService,
    private readonly security: SecurityConfig,
  ) {}
  login: RequestHandler = async (req, res) => {
    if (!req.is('application/json'))
      throw new AppError(
        415,
        'UNSUPPORTED_MEDIA_TYPE',
        'JSON content type is required',
      );
    const input = parseLogin(req.body);
    const result = await this.service.login(
      input.email,
      input.password,
      readCookie(req, cookieNames(this.security.production).session),
    );
    setAuthCookies(res, this.security, result.token, result.csrfToken);
    res
      .set('Cache-Control', 'no-store')
      .json(this.service.publicSession(result.user, result.csrfToken));
  };
  me: RequestHandler = (req, res) => {
    const principal = req.principal;
    if (!principal)
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    const csrfToken = readCookie(
      req,
      cookieNames(this.security.production).csrf,
    );
    if (!csrfToken || !tokenMatches(csrfToken, principal.csrfTokenHash))
      throw new AppError(401, 'SESSION_INVALID', 'Sign in again');
    res
      .set('Cache-Control', 'no-store')
      .json(this.service.publicSession(principal.user, csrfToken));
  };
  logout: RequestHandler = async (req, res) => {
    if (!req.principal)
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    await this.service.logout(req.principal);
    clearAuthCookies(res, this.security);
    res.status(204).end();
  };
  changePassword: RequestHandler = async (req, res) => {
    if (!req.principal)
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    const input = parsePasswordChange(req.body);
    await this.service.changePassword(
      req.principal,
      input.currentPassword,
      input.newPassword,
    );
    clearAuthCookies(res, this.security);
    res.status(204).end();
  };
}
