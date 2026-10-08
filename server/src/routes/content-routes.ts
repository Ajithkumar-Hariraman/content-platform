import { requirePermission } from '../middleware/authentication.js';
import { Router } from 'express';
import { ContentController } from '../controllers/content-controller.js';
import type { ContentService } from '../services/content-service.js';
export function contentRoutes(service: ContentService, admin = false): Router {
  const router = Router();
  const controller = new ContentController(service);
  if (admin) {
    router.get('/', requirePermission('CONTENT_READ'), controller.adminList);
    router.get('/:id', requirePermission('CONTENT_READ'), controller.detail);
    router.post('/', requirePermission('CONTENT_WRITE'), controller.create);
    router.patch('/:id', requirePermission('CONTENT_WRITE'), controller.update);
    router.post(
      '/:id/publish',
      requirePermission('CONTENT_PUBLISH'),
      controller.publish,
    );
    router.post(
      '/:id/archive',
      requirePermission('CONTENT_PUBLISH'),
      controller.archive,
    );
    router.delete(
      '/:id',
      requirePermission('CONTENT_DELETE'),
      controller.delete,
    );
  } else {
    router.get('/', controller.publicList);
    router.get('/:slug', controller.publicDetail);
  }
  return router;
}
