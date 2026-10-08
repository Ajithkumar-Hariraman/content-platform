import { Router } from 'express';
import { getHealth, getReadiness } from '../controllers/health-controller.js';
export function healthRoutes(checkConnection?: () => Promise<void>): Router {
  const router = Router();
  router.get('/', getHealth);
  router.get('/live', getHealth);
  router.get('/ready', getReadiness(checkConnection));
  return router;
}
