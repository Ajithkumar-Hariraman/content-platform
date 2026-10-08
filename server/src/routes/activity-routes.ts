import { requirePermission } from '../middleware/authentication.js';
import { Router } from 'express';
import { ActivityController } from '../controllers/activity-controller.js';
import type { ActivityService } from '../services/activity-service.js';
export function activityRoutes(service: ActivityService): Router {
  const router = Router();
  router.get(
    '/',
    requirePermission('ACTIVITY_READ'),
    new ActivityController(service).findRecent,
  );
  return router;
}
