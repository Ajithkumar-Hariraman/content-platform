import { requirePermission } from '../middleware/authentication.js';
import type { RequestHandler } from 'express';
import { Router } from 'express';
import { ProductController } from '../controllers/product-controller.js';
import type { ProductService } from '../services/product-service.js';
export function productRoutes(
  service: ProductService,
  mutationGuard: RequestHandler[] = [],
  admin = false,
): Router {
  const router = Router();
  const controller = new ProductController(service, admin);
  router.get(
    '/',
    ...(admin ? [requirePermission('PRODUCT_READ')] : []),
    controller.findAll,
  );
  router.get(
    '/:id',
    ...(admin ? [requirePermission('PRODUCT_READ')] : []),
    controller.findById,
  );
  router.post(
    '/',
    ...mutationGuard,
    requirePermission('PRODUCT_WRITE'),
    controller.create,
  );
  router.patch(
    '/:id',
    ...mutationGuard,
    requirePermission('PRODUCT_WRITE'),
    controller.update,
  );
  router.delete(
    '/:id',
    ...mutationGuard,
    requirePermission('PRODUCT_DELETE'),
    controller.delete,
  );
  return router;
}
