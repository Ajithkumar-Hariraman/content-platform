import { createServer } from 'node:http';
import { metrics } from '../metrics/registry.js';

export function startMetricsServer(env: NodeJS.ProcessEnv = process.env) {
  if (env.METRICS_ENABLED !== 'true') return undefined;
  const port = Number(env.METRICS_PORT ?? 9464);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.warn(
      JSON.stringify({ event: 'metrics_disabled', reason: 'invalid_port' }),
    );
    return undefined;
  }
  if (!['127.0.0.1', '::1'].includes(env.METRICS_HOST ?? '127.0.0.1')) {
    console.warn(
      JSON.stringify({
        event: 'metrics_disabled',
        reason: 'non_loopback_host',
      }),
    );
    return undefined;
  }
  const server = createMetricsServer();
  server.on('error', () =>
    console.warn(JSON.stringify({ event: 'metrics_listener_unavailable' })),
  );
  server.listen(port, env.METRICS_HOST ?? '127.0.0.1');
  return server;
}

export function createMetricsServer() {
  return createServer((req, res) => {
    if (req.method !== 'GET' || req.url !== '/metrics') {
      res.writeHead(404).end();
      return;
    }
    void metrics.registry
      .metrics()
      .then((body) => {
        res
          .writeHead(200, {
            'Content-Type': metrics.registry.contentType,
            'Cache-Control': 'no-store',
          })
          .end(body);
      })
      .catch(() => res.writeHead(503).end());
  });
}
