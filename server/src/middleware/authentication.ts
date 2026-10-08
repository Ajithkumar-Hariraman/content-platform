import type { RequestHandler } from 'express';
import type { AuthService } from '../services/auth-service.js';
import { AppError } from '../errors/app-error.js';
import { cookieNames, readCookie } from '../auth/cookies.js';
import { tokenMatches } from '../auth/tokens.js';
import { rolePermissions, type Permission } from '../auth/permissions.js';
import { actorContext } from '../auth/actor-context.js';
export function authenticate(
  service: AuthService | undefined,
  production: boolean,
): RequestHandler {
  return async (req, _res, next) => {
    if (!service)
      throw new AppError(
        503,
        'AUTH_UNAVAILABLE',
        'Authentication is not configured',
      );
    const token = readCookie(req, cookieNames(production).session);
    if (!token)
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    req.principal = await service.authenticate(token);
    actorContext.run({ kind: 'USER', id: req.principal.user.id }, () => next());
  };
}
export const requireCsrf: RequestHandler = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }
  if (!req.principal)
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  if (!tokenMatches(req.get('x-csrf-token'), req.principal.csrfTokenHash))
    throw new AppError(403, 'CSRF_REJECTED', 'Invalid CSRF token');
  next();
};
export function requirePermission(permission: Permission): RequestHandler {
  return (req, _res, next) => {
    if (!req.principal)
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    if (!rolePermissions[req.principal.user.role].includes(permission))
      throw new AppError(403, 'FORBIDDEN', 'Permission denied');
    next();
  };
}
export function trustedOrigin(clientOrigin: string): RequestHandler {
  return (req, _res, next) => {
    const origin = req.get('origin');
    if (origin && origin !== clientOrigin)
      throw new AppError(
        403,
        'ORIGIN_REJECTED',
        'Request origin is not allowed',
      );
    next();
  };
}
