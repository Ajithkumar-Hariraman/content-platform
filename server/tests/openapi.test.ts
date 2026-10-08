import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openapi } from '../src/openapi/specification.js';
test('OpenAPI documents request/response contracts, session and CSRF security, and public reads', () => {
  assert.equal(openapi.openapi, '3.1.0');
  assert.equal(
    openapi.paths['/api/v1/admin/diagnostics/performance'].get[
      'x-required-permission'
    ],
    'USER_WRITE',
  );
  assert.deepEqual(
    openapi.paths['/api/v1/admin/diagnostics/performance'].get.security,
    [{ sessionCookie: [] }],
  );
  assert.deepEqual(openapi.paths['/api/v1/content'].get.security, []);
  assert.deepEqual(openapi.paths['/api/v1/products'].get.security, []);
  assert.deepEqual(openapi.paths['/api/v1/admin/content'].post.security, [
    { sessionCookie: [], csrfHeader: [] },
  ]);
  assert.equal(
    openapi.paths['/api/v1/admin/users'].get['x-required-permission'],
    'USER_READ',
  );
  assert.ok(openapi.paths['/api/v1/auth/login'].post.responses['401']);
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === '$ref' && typeof child === 'string') {
        const name = child.split('/').at(-1)!;
        assert.ok(name in openapi.components.schemas, `Missing schema ${name}`);
      } else visit(child);
    }
  };
  visit(openapi);
});
