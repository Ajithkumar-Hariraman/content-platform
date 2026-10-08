import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { AuthService } from '../services/auth-service.js';
import type { SecurityConfig } from '../config/security.js';
import { AuthController } from '../controllers/auth-controller.js';
import {
  authenticate,
  requireCsrf,
  trustedOrigin,
} from '../middleware/authentication.js';
export function authRoutes(
  service: AuthService,
  security: SecurityConfig,
  clientOrigin: string,
  loginLimiter: RequestHandler,
): Router {
  const router = Router();
  const controller = new AuthController(service, security);
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.post(
    '/login',
    loginLimiter,
    trustedOrigin(clientOrigin),
    controller.login,
  );
  router.use(authenticate(service, security.production));
  router.use(trustedOrigin(clientOrigin));
  router.use(requireCsrf);
  router.get('/me', controller.me);
  router.post('/logout', controller.logout);
  router.post('/change-password', loginLimiter, controller.changePassword);
  return router;
}
