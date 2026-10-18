import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
  type ReadableSpan,
  type SpanExporter,
} from '@opentelemetry/sdk-trace-base';

export function sanitizeSpan(span: ReadableSpan): ReadableSpan {
  const attributes: ReadableSpan['attributes'] = {};
  for (const key of [
    'http.request.method',
    'http.method',
    'http.response.status_code',
    'http.status_code',
    'db.system',
    'db.system.name',
  ]) {
    const value = span.attributes[key];
    if (
      typeof value === 'number' ||
      (typeof value === 'string' &&
        /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|postgresql)$/.test(value))
    )
      attributes[key] = value;
  }
  return {
    ...span,
    spanContext: () => span.spanContext(),
    name: span.instrumentationScope.name.includes('pg')
      ? 'postgresql.query'
      : span.instrumentationScope.name.includes('express')
        ? 'express.request'
        : 'http.request',
    attributes,
    events: [],
    links: [],
    status: { code: span.status.code },
    resource: resourceFromAttributes({
      'service.name':
        span.resource.attributes['service.name'] ?? 'content-platform-api',
    }),
  };
}

export class SafeTraceExporter implements SpanExporter {
  constructor(private readonly exporter: SpanExporter) {}
  export(
    spans: ReadableSpan[],
    callback: Parameters<SpanExporter['export']>[1],
  ) {
    try {
      this.exporter.export(spans.map(sanitizeSpan), (result) =>
        callback({ code: result.code }),
      );
    } catch {
      callback({ code: 1 });
    }
  }
  async shutdown() {
    try {
      await this.exporter.shutdown();
    } catch {
      /* Export failures do not affect application shutdown. */
    }
  }
}

let activeSdk: NodeSDK | undefined;
export async function shutdownTracing() {
  try {
    await activeSdk?.shutdown();
  } catch {
    return;
  }
}

export function startTracing(
  env: NodeJS.ProcessEnv = process.env,
  makeExporter: () => SpanExporter = () =>
    new OTLPTraceExporter({ timeoutMillis: 2000 }),
) {
  if (env.OTEL_ENABLED !== 'true') return undefined;
  try {
    const endpoint =
      env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ?? env.OTEL_EXPORTER_OTLP_ENDPOINT;
    if (endpoint) {
      const url = new URL(endpoint);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error('Invalid endpoint');
    }
    const ratio = Number(env.OTEL_TRACES_SAMPLER_ARG ?? 0.1);
    if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1)
      throw new Error('Invalid sampling');
    const sdk = new NodeSDK({
      autoDetectResources: false,
      resource: resourceFromAttributes({
        'service.name': /^[a-zA-Z0-9._-]{1,100}$/.test(
          env.OTEL_SERVICE_NAME ?? '',
        )
          ? env.OTEL_SERVICE_NAME!
          : 'content-platform-api',
      }),
      sampler: new ParentBasedSampler({
        root: new TraceIdRatioBasedSampler(ratio),
      }),
      spanProcessors: [
        new BatchSpanProcessor(new SafeTraceExporter(makeExporter()), {
          maxQueueSize: 1024,
          maxExportBatchSize: 128,
          scheduledDelayMillis: 5000,
          exportTimeoutMillis: 2500,
        }),
      ],
      instrumentations: [
        new HttpInstrumentation({
          disableOutgoingRequestInstrumentation: true,
          ignoreIncomingRequestHook: (req) => req.url === '/metrics',
        }),
        new ExpressInstrumentation(),
        new PgInstrumentation({ enhancedDatabaseReporting: false }),
      ],
    });
    sdk.start();
    activeSdk = sdk;
    return sdk;
  } catch {
    console.warn(
      JSON.stringify({
        event: 'tracing_disabled',
        reason: 'initialization_failed',
      }),
    );
    return undefined;
  }
}
