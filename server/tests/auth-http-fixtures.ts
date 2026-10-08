import { AuthService } from '../src/services/auth-service.js';
import { hashToken } from '../src/auth/tokens.js';
import { principal } from './auth-fixtures.js';
export const sessionToken = 'A'.repeat(43);
export const csrfToken = 'B'.repeat(43);
export function testAuthentication() {
  return new AuthService(
    {
      async findCredentials() {
        throw new Error('Unexpected credential lookup');
      },
      async createSession() {
        throw new Error('Unexpected session creation');
      },
      async findActiveSession(hash) {
        return hash === hashToken(sessionToken)
          ? { ...principal(), csrfTokenHash: hashToken(csrfToken) }
          : null;
      },
      async revokeSession() {},
      async changePassword() {
        throw new Error('Unexpected password change');
      },
    },
    3600000,
  );
}

import request from 'supertest';
import type { Express } from 'express';
export function authenticatedAgent(app: Express) {
  return request
    .agent(app)
    .set('Cookie', `cloudops_session=${sessionToken}`)
    .set('X-CSRF-Token', csrfToken);
}
