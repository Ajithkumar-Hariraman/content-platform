import { metrics } from '../metrics/registry.js';
import { readPerformanceConfig } from '../config/performance.js';
import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export const requestLogging: RequestHandler = (req, res, next) => {
  const incoming = req.get('x-request-id');
  const requestId =
    incoming && /^[a-zA-Z0-9._-]{1,128}$/.test(incoming)
      ? incoming
      : randomUUID();
  res.locals.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  const start = performance.now();
  const threshold = readPerformanceConfig(process.env).slowRequestMs;
  res.on('finish', () => {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    const route =
      req.route && typeof req.route.path === 'string'
        ? `${req.baseUrl}${req.route.path}`
        : 'unmatched';
    metrics.observe(
      `http_request_duration_ms:${req.method}:${route}:${res.statusCode}`,
      durationMs,
    );
    if (durationMs >= threshold)
      console.warn(
        JSON.stringify({
          level: 'warn',
          event: 'slow_request',
          requestId,
          method: req.method,
          path: route,
          statusCode: res.statusCode,
          durationMs,
        }),
      );
    console.log(
      JSON.stringify({
        level: 'info',
        event: 'http_request',
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs,
      }),
    );
  });
  next();
};
