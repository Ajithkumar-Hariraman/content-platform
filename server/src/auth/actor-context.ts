import { AsyncLocalStorage } from 'node:async_hooks';
import type { ActivityEvent } from '../events/activity-event.js';
export const actorContext = new AsyncLocalStorage<ActivityEvent['actor']>();
