import { register } from 'node:module';

if (process.env.OTEL_ENABLED === 'true') {
  try {
    register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);
    const { startTracing } = await import('./tracing.js');
    const sdk = startTracing();
    if (sdk)
      process.once('beforeExit', () => {
        void sdk.shutdown().catch(() => undefined);
      });
  } catch {
    console.warn(
      JSON.stringify({ event: 'tracing_disabled', reason: 'preload_failed' }),
    );
  }
}
