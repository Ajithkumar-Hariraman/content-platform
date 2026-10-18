import { context, trace, isSpanContextValid } from '@opentelemetry/api';
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
  const spanContext = trace.getSpan(context.active())?.spanContext();
  const correlation =
    spanContext && isSpanContextValid(spanContext)
      ? { trace_id: spanContext.traceId, span_id: spanContext.spanId }
      : {};
  metrics.inFlight.inc();
  const start = performance.now();
  const threshold = readPerformanceConfig(process.env).slowRequestMs;
  res.once('close', () => metrics.inFlight.dec());
  res.on('finish', () => {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    const route =
      req.route && typeof req.route.path === 'string'
        ? `${req.baseUrl}${req.route.path}`
        : 'unmatched';
    metrics.recordHttp(req.method, route, res.statusCode, durationMs);
    if (durationMs >= threshold)
      console.warn(
        JSON.stringify({
          level: 'warn',
          event: 'slow_request',
          requestId,
          ...correlation,
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
        ...correlation,
        method: req.method,
        path: route,
        statusCode: res.statusCode,
        durationMs,
      }),
    );
  });
  next();
};
