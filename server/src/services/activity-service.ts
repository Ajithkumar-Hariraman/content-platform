import type { ActivityRepository } from '../repositories/activity-repository.js';
import type { ActivityQuery } from '../validation/activity.js';
import { AppError } from '../errors/app-error.js';
export class ActivityService {
  constructor(
    private readonly repository: Pick<ActivityRepository, 'findRecent'>,
  ) {}
  async findRecent(query: ActivityQuery) {
    try {
      return await this.repository.findRecent(query);
    } catch {
      throw new AppError(
        503,
        'ACTIVITY_UNAVAILABLE',
        'Activity storage is temporarily unavailable',
      );
    }
  }
}
