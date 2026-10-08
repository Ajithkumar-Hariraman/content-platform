import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseLogin,
  parseCreateUser,
  parsePasswordChange,
  parseRole,
  parseStatus,
} from '../src/validation/auth.js';
import { readSecurityConfig } from '../src/config/security.js';
import {
  readCookie,
  cookieNames,
  setAuthCookies,
  clearAuthCookies,
} from '../src/auth/cookies.js';
import type { Request, Response, CookieOptions } from 'express';
import { randomToken } from '../src/auth/tokens.js';
test('authentication inputs normalize emails, bound passwords and reject arbitrary roles/status', () => {
  assert.equal(
    parseLogin({ email: ' ADMIN@example.test ', password: 'test' }).email,
    'admin@example.test',
  );
  for (const input of [
    { email: 'bad', password: 'test-password-124' },
    { email: 'admin@example.test', password: 'short' },
    {
      email: 'admin@example.test',
      password: 'long-password-124',
      role: 'OWNER',
    },
  ])
    assert.throws(() => parseCreateUser(input));
  assert.throws(() =>
    parsePasswordChange({ currentPassword: 'x', newPassword: 'a'.repeat(129) }),
  );
  assert.throws(() => parseRole({ role: 'ROOT' }));
  assert.throws(() => parseStatus({ status: 'DELETED' }));
});
test('production cookies are host-bound Secure HttpOnly SameSite and clearing preserves attributes', () => {
  const tokens: string[] = [];
  const options: CookieOptions[] = [];
  const res = {
    cookie(name: string, token: string, settings: CookieOptions) {
      tokens.push(name, token);
      options.push(settings);
    },
    clearCookie(_name: string, settings: CookieOptions) {
      options.push(settings);
    },
  } as unknown as Response;
  const config = readSecurityConfig({ NODE_ENV: 'production' });
  setAuthCookies(res, config, randomToken(), randomToken());
  clearAuthCookies(res, config);
  assert.equal(tokens[0], '__Host-cloudops_session');
  for (const settings of options) {
    assert.equal(settings.httpOnly, true);
    assert.equal(settings.secure, true);
    assert.equal(settings.sameSite, 'lax');
    assert.equal(settings.path, '/');
    assert.equal(settings.domain, undefined);
  }
  assert.equal(config.docsEnabled, false);
  assert.equal(
    readSecurityConfig({ NODE_ENV: 'development' }).production,
    false,
  );
  assert.equal(cookieNames(false).session, 'cloudops_session');
});
test('cookie parsing rejects duplicate and malformed session cookies', () => {
  const token = randomToken();
  const request = (cookie: string) =>
    ({
      get() {
        return cookie;
      },
    }) as unknown as Request;
  assert.equal(
    readCookie(request(`cloudops_session=${token}`), 'cloudops_session'),
    token,
  );
  assert.equal(
    readCookie(
      request(`cloudops_session=${token}; cloudops_session=${token}`),
      'cloudops_session',
    ),
    undefined,
  );
  assert.equal(
    readCookie(request('cloudops_session=invalid'), 'cloudops_session'),
    undefined,
  );
});
