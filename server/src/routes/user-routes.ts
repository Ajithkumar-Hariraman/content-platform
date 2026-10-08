import { Router } from 'express';
import type { UserService } from '../services/user-service.js';
import { UserController } from '../controllers/user-controller.js';
import { requirePermission } from '../middleware/authentication.js';
export function userRoutes(service: UserService): Router {
  const router = Router();
  const controller = new UserController(service);
  router.get('/', requirePermission('USER_READ'), controller.list);
  router.post('/', requirePermission('USER_WRITE'), controller.create);
  router.patch('/:id/role', requirePermission('USER_WRITE'), controller.role);
  router.patch(
    '/:id/status',
    requirePermission('USER_WRITE'),
    controller.status,
  );
  return router;
}
