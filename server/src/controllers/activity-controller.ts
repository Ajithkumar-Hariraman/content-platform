import type { RequestHandler } from 'express';
import type { ActivityService } from '../services/activity-service.js';
import { parseActivityQuery } from '../validation/activity.js';
export class ActivityController {
  constructor(private readonly service: ActivityService) {}
  findRecent: RequestHandler = async (req, res) => {
    res.json(await this.service.findRecent(parseActivityQuery(req.query)));
  };
}
