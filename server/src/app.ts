import { readPerformanceConfig } from './config/performance.js';
import { metrics } from './metrics/registry.js';
import { requirePermission } from './middleware/authentication.js';
import helmet from 'helmet';
import proxyaddr from 'proxy-addr';
import { rateLimit } from 'express-rate-limit';
import type { AuthService } from './services/auth-service.js';
import type { UserService } from './services/user-service.js';
import { authRoutes } from './routes/auth-routes.js';
import { userRoutes } from './routes/user-routes.js';
import {
  authenticate,
  requireCsrf,
  trustedOrigin,
} from './middleware/authentication.js';
import { readSecurityConfig, type SecurityConfig } from './config/security.js';
import { docsRoutes } from './openapi/routes.js';
import type { ActivityService } from './services/activity-service.js';
import { activityRoutes } from './routes/activity-routes.js';
import express, { type RequestHandler } from 'express';
import type { ContentService } from './services/content-service.js';
import { contentRoutes } from './routes/content-routes.js';
import cors from 'cors';
import type { Config } from './config/env.js';
import { requestLogging } from './middleware/request-logging.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import type { CatalogServices } from './services/catalog.js';
import { productRoutes } from './routes/product-routes.js';
import { categoryRoutes } from './routes/category-routes.js';
import { AppError } from './errors/app-error.js';
import { healthRoutes } from './routes/health-routes.js';

export function createApp(
  config: Config,
  catalog?: CatalogServices,
  content?: ContentService,
  readiness?: () => Promise<void>,
  activity?: ActivityService,
  auth?: AuthService,
  users?: UserService,
  security: SecurityConfig = readSecurityConfig({ NODE_ENV: config.nodeEnv }),
  poolStatistics?: () => {
    total: number;
    idle: number;
    waiting: number;
    max: number;
  },
) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustedProxyCidrs && config.cloudfrontProxyCidrs) {
    const alb = proxyaddr.compile(config.trustedProxyCidrs);
    const cloudfront = proxyaddr.compile(config.cloudfrontProxyCidrs);
    app.set('trust proxy', (ip: string, hop: number) =>
      hop === 0 ? alb(ip, hop) : hop === 1 ? cloudfront(ip, hop) : false,
    );
  }
  app.use(requestLogging);
  app.use(
    helmet({
      ...(!security.production ? { strictTransportSecurity: false } : {}),
      contentSecurityPolicy: {
        directives: {
          'upgrade-insecure-requests': security.production ? [] : null,
        },
      },
    }),
  );
  app.use(
    cors({
      origin: config.clientOrigin,
      credentials: true,
      allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-Id'],
    }),
  );
  const limited: RequestHandler = (_req, _res, next) =>
    next(new AppError(429, 'RATE_LIMITED', 'Too many requests'));
  const loginLimited: RequestHandler = (_req, _res, next) =>
    next(new AppError(429, 'RATE_LIMITED', 'Too many authentication attempts'));
  const limiter = rateLimit({
    windowMs: 60000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: limited,
  });
  const loginLimiter = rateLimit({
    windowMs: 15 * 60000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: loginLimited,
  });
  if (
    !readPerformanceConfig({ ...process.env, NODE_ENV: config.nodeEnv })
      .performanceMode
  )
    app.use('/api/v1', limiter);
  const authenticated = authenticate(auth, security.production);
  const guard = [
    authenticated,
    trustedOrigin(config.clientOrigin),
    requireCsrf,
  ];
  app.use('/api/v1/admin', ...guard, (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.use(express.json({ limit: '100kb' }));
  app.get(
    '/api/v1/admin/diagnostics/performance',
    requirePermission('USER_WRITE'),
    (_req, res) => {
      res.json({
        metrics: metrics.snapshot(),
        pool: poolStatistics?.(),
        process: {
          uptimeSeconds: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
        },
      });
    },
  );
  app.use('/api/v1/health', healthRoutes(readiness));
  if (security.docsEnabled) app.use('/api/docs', docsRoutes());
  if (auth)
    app.use(
      '/api/v1/auth',
      authRoutes(auth, security, config.clientOrigin, loginLimiter),
    );
  else
    app.use('/api/v1/auth', (_req, _res, next) =>
      next(
        new AppError(
          503,
          'AUTH_UNAVAILABLE',
          'Authentication is not configured',
        ),
      ),
    );
  if (users) app.use('/api/v1/admin/users', userRoutes(users));

  if (catalog) {
    app.use('/api/v1/products', productRoutes(catalog.products, guard));
    app.use(
      '/api/v1/admin/products',
      productRoutes(catalog.products, [], true),
    );
    app.use('/api/v1/categories', categoryRoutes(catalog.categories));
  } else {
    app.use(['/api/v1/products', '/api/v1/categories'], (_req, _res, next) => {
      next(
        new AppError(
          503,
          'DATABASE_UNAVAILABLE',
          'Catalog database is not configured',
        ),
      );
    });
  }
  if (content) {
    app.use('/api/v1/admin/content', contentRoutes(content, true));
    app.use('/api/v1/content', contentRoutes(content));
  } else {
    app.use(['/api/v1/content', '/api/v1/admin/content'], (_req, _res, next) =>
      next(
        new AppError(
          503,
          'DATABASE_UNAVAILABLE',
          'Content database is not configured',
        ),
      ),
    );
  }
  if (activity) app.use('/api/v1/admin/activity', activityRoutes(activity));
  else
    app.use('/api/v1/admin/activity', (_req, _res, next) =>
      next(
        new AppError(
          503,
          'ACTIVITY_UNAVAILABLE',
          'Activity storage is not configured',
        ),
      ),
    );
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
