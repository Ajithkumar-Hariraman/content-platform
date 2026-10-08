import type { Request, Response, CookieOptions } from 'express';
import type { SecurityConfig } from '../config/security.js';
export function cookieNames(production: boolean) {
  return {
    session: production ? '__Host-cloudops_session' : 'cloudops_session',
    csrf: production ? '__Host-cloudops_csrf' : 'cloudops_csrf',
  };
}
export function readCookie(req: Request, name: string): string | undefined {
  const matches = (req.get('cookie') ?? '')
    .split(';')
    .map((item) => item.trim())
    .filter((item) => item.startsWith(`${name}=`));
  if (matches.length !== 1) return undefined;
  const token = matches[0]?.slice(name.length + 1);
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
}
function options(config: SecurityConfig): CookieOptions {
  return {
    secure: config.production,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: config.sessionLifetimeMs,
  };
}
export function setAuthCookies(
  res: Response,
  config: SecurityConfig,
  token: string,
  csrfToken: string,
) {
  const names = cookieNames(config.production);
  res.cookie(names.session, token, options(config));
  res.cookie(names.csrf, csrfToken, options(config));
}
export function clearAuthCookies(res: Response, config: SecurityConfig) {
  const names = cookieNames(config.production);
  const clearOptions = options(config);
  delete clearOptions.maxAge;
  res.clearCookie(names.session, clearOptions);
  res.clearCookie(names.csrf, clearOptions);
}
