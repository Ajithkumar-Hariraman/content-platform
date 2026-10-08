import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config/env.js';
import { authFixture, password } from './auth-fixtures.js';

const config = {
  nodeEnv: 'production' as const,
  port: 3000,
  clientOrigin: 'https://demo.cloudfront.net',
  trustedProxyCidrs: ['10.42.0.0/24', '10.42.1.0/24'],
  cloudfrontProxyCidrs: ['192.0.2.0/24'],
};
test('proxy trust is restricted to the ALB and CloudFront hop positions', () => {
  const app = createApp(config);
  const trust = app.get('trust proxy fn') as (
    ip: string,
    hop: number,
  ) => boolean;
  assert.equal(trust('10.42.0.15', 0), true);
  assert.equal(trust('::ffff:10.42.1.15', 0), true);
  assert.equal(trust('192.0.2.15', 1), true);
  assert.equal(trust('192.0.2.15', 0), false);
  assert.equal(trust('10.42.0.15', 1), false);
  assert.equal(trust('192.0.2.15', 2), false);
  assert.equal(trust('198.51.100.15', 0), false);
  assert.throws(
    () =>
      readConfig({
        CLIENT_ORIGIN: config.clientOrigin,
        CLOUDFRONT_PROXY_CIDRS: '0.0.0.0/0',
        TRUSTED_PROXY_CIDRS: '10.42.0.0/24',
      }),
    /CIDRs/,
  );
});
test('production login sets secure host cookies even when the ALB uses HTTP', async () => {
  const fixture = await authFixture();
  const app = createApp(
    config,
    undefined,
    undefined,
    undefined,
    undefined,
    fixture.service,
  );
  const response = await request(app)
    .post('/api/v1/auth/login')
    .set('Origin', config.clientOrigin)
    .set('X-Forwarded-Proto', 'http')
    .send({ email: fixture.user().email, password });
  assert.equal(response.status, 200);
  const cookies = response.headers['set-cookie'] as unknown as string[];
  assert.equal(cookies.length, 2);
  for (const cookie of cookies) {
    assert.match(cookie, /^__Host-cloudops_/);
    for (const flag of ['Secure', 'HttpOnly', 'SameSite=Lax', 'Path=/'])
      assert.ok(cookie.includes(flag));
    assert.equal(cookie.includes('Domain='), false);
  }
});
