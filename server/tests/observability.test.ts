import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import {
  createMetricsServer,
  startMetricsServer,
} from '../src/observability/metrics-server.js';
import { metrics } from '../src/metrics/registry.js';
import { requestLogging } from '../src/middleware/request-logging.js';
import {
  startTracing,
  SafeTraceExporter,
  sanitizeSpan,
} from '../src/observability/tracing.js';
import { resourceFromAttributes } from '@opentelemetry/resources';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';

test('internal scrape endpoint exports Prometheus metrics and no API routes', async () => {
  const server = createMetricsServer();
  const response = await request(server).get('/metrics').expect(200);
  assert.match(response.headers['content-type'] ?? '', /text\/plain/);
  assert.match(response.text, /process_resident_memory_bytes/);
  await request(server).get('/api/v1/health').expect(404);
  await request(server).post('/metrics').expect(404);
  assert.equal(startMetricsServer({ METRICS_ENABLED: 'false' }), undefined);
  assert.equal(
    startMetricsServer({ METRICS_ENABLED: 'true', METRICS_HOST: '0.0.0.0' }),
    undefined,
  );
});

test('HTTP metrics and logs use route templates, safe methods and status classes', async (context) => {
  const logs: string[] = [];
  context.mock.method(console, 'log', (line: string) => logs.push(line));
  const app = express();
  app.use(requestLogging);
  app.get('/entities/:id', (_req, res) => res.status(200).json({ ok: true }));
  for (const id of ['private-id-1', 'private-id-2']) {
    const response = await request(app)
      .get(`/entities/${id}?token=secret-query`)
      .set('Authorization', 'Bearer secret-header')
      .set('Cookie', 'session=secret-cookie')
      .set('x-request-id', 'retained-id');
    assert.equal(response.headers['x-request-id'], 'retained-id');
  }
  await request(app).get('/private-unmatched-secret').expect(404);
  const output = await metrics.registry.metrics();
  assert.match(
    output,
    /http_requests_total\{method="GET",route="\/entities\/:id",status_class="2xx"\} 2/,
  );
  assert.match(output, /route="unmatched",status_class="4xx"/);
  assert.match(output, /http_requests_in_flight 0/);
  for (const secret of [
    'private-id',
    'secret-query',
    'secret-header',
    'secret-cookie',
    'private-unmatched-secret',
  ]) {
    assert.ok(!output.includes(secret));
    assert.ok(!logs.join('').includes(secret));
  }
});

test('disabled tracing and initialization failure leave application usable', (context) => {
  context.mock.method(console, 'warn', () => undefined);
  assert.equal(
    startTracing({ OTEL_ENABLED: 'false' }, () => {
      throw new Error('must not initialize');
    }),
    undefined,
  );
  assert.equal(
    startTracing({ OTEL_ENABLED: 'true' }, () => {
      throw new Error('secret exporter failure');
    }),
    undefined,
  );
  assert.equal(
    startTracing({
      OTEL_ENABLED: 'true',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'bad-url-secret',
    }),
    undefined,
  );
});

test('export failures are contained and spans omit SQL, URLs, credentials and exception details', async () => {
  const span = {
    name: 'SELECT secret-password',
    spanContext: () => ({
      traceId: '1'.repeat(32),
      spanId: '2'.repeat(16),
      traceFlags: 1,
    }),
    attributes: {
      'db.statement': 'secret-sql',
      'http.url': 'https://secret-url',
      'http.method': 'GET',
      'http.status_code': 500,
      'db.user': 'secret-user',
    },
    events: [{ name: 'secret-exception' }],
    links: [],
    status: { code: 2, message: 'secret-message' },
    resource: resourceFromAttributes({
      'service.name': 'api',
      'process.command_args': ['secret-token'],
    }),
    instrumentationScope: { name: '@opentelemetry/instrumentation-pg' },
  } as unknown as ReadableSpan;
  const cleaned = sanitizeSpan(span);
  assert.ok(!JSON.stringify(cleaned).includes('secret'));
  assert.equal(cleaned.name, 'postgresql.query');
  assert.equal(cleaned.attributes['http.status_code'], 500);
  const exporter = new SafeTraceExporter({
    export() {
      throw new Error('secret-network');
    },
    async shutdown() {
      throw new Error('secret-shutdown');
    },
  });
  let code = -1;
  exporter.export([span], (result) => {
    code = result.code;
  });
  assert.equal(code, 1);
  await exporter.shutdown();
});

test('ESM preload creates correlated HTTP, Express and pg traces; unavailable collector preserves API', async () => {
  const { createServer } = await import('node:http');
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execute = promisify(execFile);
  const payloads: string[] = [];
  const collector = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += String(chunk);
    });
    req.on('end', () => {
      payloads.push(body);
      res.writeHead(200, { 'Content-Type': 'application/json' }).end('{}');
    });
  });
  collector.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => collector.once('listening', resolve));
  const address = collector.address();
  assert.ok(address && typeof address !== 'string');
  try {
    for (const endpoint of [
      `http://127.0.0.1:${address.port}`,
      'http://127.0.0.1:1',
    ]) {
      const result = await execute(
        process.execPath,
        [
          '--import',
          'tsx',
          '--import',
          './src/observability/preload.ts',
          'tests/fixtures/tracing-smoke.mjs',
        ],
        {
          cwd: new URL('../', import.meta.url),
          env: {
            ...process.env,
            OTEL_ENABLED: 'true',
            OTEL_TRACES_SAMPLER_ARG: '1',
            OTEL_EXPORTER_OTLP_ENDPOINT: endpoint,
          },
          timeout: 15000,
        },
      );
      assert.match(result.stdout, /"trace_id":"[a-f0-9]{32}"/);
      assert.match(result.stdout, /"span_id":"[a-f0-9]{16}"/);
      assert.ok(!result.stdout.includes('secret'));
    }
    const body = payloads.join('');
    for (const scope of [
      'instrumentation-http',
      'instrumentation-express',
      'instrumentation-pg',
    ])
      assert.ok(body.includes(scope), scope);
    assert.ok(!body.includes('secret'));
    assert.ok(!body.includes('private-id'));
  } finally {
    await new Promise<void>((resolve) => collector.close(() => resolve()));
  }
});
