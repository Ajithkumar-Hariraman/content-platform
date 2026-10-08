import { Router } from 'express';
import { CategoryController } from '../controllers/category-controller.js';
import type { CategoryService } from '../services/category-service.js';
export function categoryRoutes(service: CategoryService): Router {
  const router = Router();
  router.get('/', new CategoryController(service).findAll);
  return router;
}
