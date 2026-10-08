import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Request, Response, RequestHandler } from 'express';
import {
  authenticate,
  requireCsrf,
  requirePermission,
  trustedOrigin,
} from '../src/middleware/authentication.js';
import { authFixture, password, principal } from './auth-fixtures.js';
import { AppError } from '../src/errors/app-error.js';
import { hashToken, randomToken } from '../src/auth/tokens.js';
import { activityEvent } from '../src/events/activity-event.js';
import { actorContext } from '../src/auth/actor-context.js';
const res = {} as Response;
function req(method = 'GET', headers: Record<string, string> = {}): Request {
  return {
    method,
    get(name: string) {
      return headers[name.toLowerCase()];
    },
  } as Request;
}
const status = (code: number) => (error: unknown) =>
  error instanceof AppError && error.statusCode === code;
async function invoke(handler: RequestHandler, request: Request) {
  let advanced = false;
  await handler(request, res, () => {
    advanced = true;
  });
  return advanced;
}
test('protected middleware rejects anonymous requests and attaches verified identity', async () => {
  const fixture = await authFixture();
  const guard = authenticate(fixture.service, false);
  await assert.rejects(invoke(guard, req()), status(401));
  const result = await fixture.service.login(fixture.user().email, password);
  const request = req('GET', { cookie: `cloudops_session=${result.token}` });
  assert.equal(await invoke(guard, request), true);
  assert.equal(request.principal?.user.id, fixture.user().id);
});
test('CSRF rejects absent/wrong values and accepts session-bound mutation headers; GET needs no CSRF', async () => {
  const token = randomToken();
  const request = req('POST');
  request.principal = { ...principal(), csrfTokenHash: hashToken(token) };
  await assert.rejects(invoke(requireCsrf, request), status(403));
  const wrong = req('PATCH', { 'x-csrf-token': randomToken() });
  wrong.principal = request.principal;
  await assert.rejects(invoke(requireCsrf, wrong), status(403));
  const valid = req('DELETE', { 'x-csrf-token': token });
  valid.principal = request.principal;
  assert.equal(await invoke(requireCsrf, valid), true);
  assert.equal(await invoke(requireCsrf, req('GET')), true);
});
test('central permissions deny VIEWER writes/deletes, allow EDITOR writes, and reserve users for ADMIN', async () => {
  for (const role of ['VIEWER', 'EDITOR', 'ADMIN'] as const) {
    const request = req();
    request.principal = principal(role);
    assert.equal(
      await invoke(requirePermission('CONTENT_READ'), request),
      true,
    );
    if (role === 'VIEWER')
      await assert.rejects(
        invoke(requirePermission('CONTENT_WRITE'), request),
        status(403),
      );
    else
      assert.equal(
        await invoke(requirePermission('CONTENT_WRITE'), request),
        true,
      );
    if (role !== 'ADMIN') {
      await assert.rejects(
        invoke(requirePermission('USER_READ'), request),
        status(403),
      );
      await assert.rejects(
        invoke(requirePermission('PRODUCT_DELETE'), request),
        status(403),
      );
    } else
      assert.equal(
        await invoke(requirePermission('USER_WRITE'), request),
        true,
      );
  }
});
test('authentication scopes actual actor identity to the request and keeps system events separate', async () => {
  const fixture = await authFixture();
  const result = await fixture.service.login(fixture.user().email, password);
  let actor: unknown;
  await authenticate(fixture.service, false)(
    req('POST', { cookie: `cloudops_session=${result.token}` }),
    res,
    () => {
      actor = activityEvent(
        'CONTENT_CREATED',
        'CONTENT',
        fixture.user().id,
      ).actor;
    },
  );
  assert.deepEqual(actor, { kind: 'USER', id: fixture.user().id });
  assert.equal(actorContext.getStore(), undefined);
  assert.deepEqual(
    activityEvent('CONTENT_CREATED', 'CONTENT', fixture.user().id).actor,
    { kind: 'SYSTEM' },
  );
});
test('cross-origin authenticated mutations are rejected independently of CSRF', async () => {
  await assert.rejects(
    invoke(
      trustedOrigin('http://localhost:5173'),
      req('POST', { origin: 'https://untrusted.example' }),
    ),
    status(403),
  );
  assert.equal(
    await invoke(
      trustedOrigin('http://localhost:5173'),
      req('POST', { origin: 'http://localhost:5173' }),
    ),
    true,
  );
});
