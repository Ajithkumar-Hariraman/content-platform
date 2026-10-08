import type { RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';
export const getHealth: RequestHandler = (_req, res) => {
  res.json({ status: 'ok', service: 'cloudops-content-api' });
};
export function getReadiness(
  checkConnection?: () => Promise<void>,
): RequestHandler {
  return async (_req, res) => {
    try {
      if (!checkConnection) throw new Error('Database is not configured');
      await checkConnection();
      res.json({ status: 'ready', service: 'cloudops-content-api' });
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'readiness_dependency_failed',
          requestId: res.locals.requestId,
          dependency: 'postgres',
          code:
            error && typeof error === 'object' && 'code' in error
              ? String(error.code)
              : 'UNAVAILABLE',
        }),
      );
      throw new AppError(503, 'NOT_READY', 'PostgreSQL dependency unavailable');
    }
  };
}
