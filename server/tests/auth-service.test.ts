import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authFixture, password } from './auth-fixtures.js';
import { hashPassword, verifyPassword } from '../src/auth/password.js';
import { hashToken } from '../src/auth/tokens.js';
import { AppError } from '../src/errors/app-error.js';
const status = (code: number) => (error: unknown) =>
  error instanceof AppError && error.statusCode === code;
test('scrypt uses independent salts and rejects incorrect or malformed credentials', async () => {
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('wrong', first), false);
  assert.equal(await verifyPassword(password, 'malformed'), false);
  assert.equal(first.includes(password), false);
});
test('successful login stores only token hashes and regenerates/revokes previous session', async () => {
  const fixture = await authFixture();
  const first = await fixture.service.login(fixture.user().email, password);
  assert.equal(first.token.length, 43);
  assert.equal(first.csrfToken.length, 43);
  assert.equal(fixture.sessions.has(first.token), false);
  assert.equal(fixture.sessions.has(hashToken(first.token)), true);
  const authenticated = await fixture.service.authenticate(first.token);
  assert.equal(authenticated.user.id, fixture.user().id);
  assert.equal('passwordHash' in authenticated.user, false);
  assert.equal(authenticated.csrfTokenHash, hashToken(first.csrfToken));
  const next = await fixture.service.login(
    first.user.email,
    password,
    first.token,
  );
  assert.notEqual(first.token, next.token);
  await assert.rejects(fixture.service.authenticate(first.token), status(401));
  assert.equal(
    (await fixture.service.authenticate(next.token)).user.email,
    first.user.email,
  );
});
test('invalid credentials, missing and disabled users share generic rejection without sessions', async () => {
  const fixture = await authFixture();
  for (const [email, secret] of [
    [fixture.user().email, 'incorrect'],
    ['missing@example.test', password],
  ])
    await assert.rejects(fixture.service.login(email!, secret!), status(401));
  fixture.setUser({ status: 'DISABLED' });
  await assert.rejects(
    fixture.service.login(fixture.user().email, password),
    status(401),
  );
  assert.equal(fixture.sessions.size, 0);
});
test('logout, expiry, revocation and disabled accounts reject sessions', async () => {
  const fixture = await authFixture();
  const result = await fixture.service.login(fixture.user().email, password);
  await fixture.service.logout(
    await fixture.service.authenticate(result.token),
  );
  await assert.rejects(fixture.service.authenticate(result.token), status(401));
  const second = await fixture.service.login(fixture.user().email, password);
  fixture.sessions.get(hashToken(second.token))!.expires = new Date(0);
  await assert.rejects(fixture.service.authenticate(second.token), status(401));
  const third = await fixture.service.login(fixture.user().email, password);
  fixture.setUser({ status: 'DISABLED' });
  await assert.rejects(fixture.service.authenticate(third.token), status(401));
});
test('password change verifies current credential and revokes every session', async () => {
  const fixture = await authFixture();
  const first = await fixture.service.login(fixture.user().email, password);
  const second = await fixture.service.login(fixture.user().email, password);
  const principal = await fixture.service.authenticate(first.token);
  await assert.rejects(
    fixture.service.changePassword(
      principal,
      'wrong',
      'another-test-password-349',
    ),
    status(400),
  );
  assert.equal(
    (await fixture.service.authenticate(first.token)).user.id,
    principal.user.id,
  );
  await fixture.service.changePassword(
    principal,
    password,
    'another-test-password-349',
  );
  await assert.rejects(fixture.service.authenticate(first.token), status(401));
  await assert.rejects(fixture.service.authenticate(second.token), status(401));
  await assert.rejects(
    fixture.service.login(principal.user.email, password),
    status(401),
  );
  assert.ok(
    (
      await fixture.service.login(
        principal.user.email,
        'another-test-password-349',
      )
    ).token,
  );
});
