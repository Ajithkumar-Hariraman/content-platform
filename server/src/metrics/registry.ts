import {
  Registry,
  Counter,
  Histogram as PromHistogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';
const bounds = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000];
interface Histogram {
  count: number;
  sumMs: number;
  maxMs: number;
  buckets: number[];
}
export class Metrics {
  readonly registry = new Registry();
  private readonly httpCount = new Counter({
    name: 'http_requests_total',
    help: 'Completed HTTP requests',
    labelNames: ['method', 'route', 'status_class'],
    registers: [this.registry],
  });
  private readonly httpDuration = new PromHistogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP duration',
    labelNames: ['method', 'route', 'status_class'],
    buckets: bounds.map((x) => x / 1000),
    registers: [this.registry],
  });
  readonly inFlight = new Gauge({
    name: 'http_requests_in_flight',
    help: 'Active HTTP requests',
    registers: [this.registry],
  });
  private readonly exportedCounters = new Map<string, Counter>();
  private readonly exportedDurations = new Map<string, PromHistogram>();
  constructor(runtime = false) {
    for (const name of [
      'cache_hit_total',
      'cache_miss_total',
      'cache_error_total',
      'database_slow_queries_total',
      'outbox_processed_total',
      'outbox_retried_total',
      'outbox_failed_total',
    ])
      this.exportedCounters.set(
        name,
        new Counter({ name, help: name, registers: [this.registry] }),
      );
    for (const name of [
      'cache_get_duration_ms',
      'cache_set_duration_ms',
      'database_query_duration_ms',
    ])
      this.exportedDurations.set(
        name,
        new PromHistogram({
          name: name.replace('_ms', '_seconds'),
          help: name,
          labelNames: name.startsWith('database') ? ['operation'] : [],
          buckets: bounds.map((x) => x / 1000),
          registers: [this.registry],
        }),
      );
    if (runtime) collectDefaultMetrics({ register: this.registry });
  }
  recordHttp(method: string, route: string, status: number, ms: number) {
    const labels = {
      method: [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'HEAD',
        'OPTIONS',
      ].includes(method)
        ? method
        : 'OTHER',
      route,
      status_class: `${Math.floor(status / 100)}xx`,
    };
    this.httpCount.inc(labels);
    this.httpDuration.observe(labels, ms / 1000);
  }
  private counters = new Map<string, number>();
  private durations = new Map<string, Histogram>();
  increment(name: string, amount = 1) {
    this.exportedCounters.get(name)?.inc(amount);
    this.counters.set(name, (this.counters.get(name) ?? 0) + amount);
  }
  observe(name: string, durationMs: number) {
    const [base, operation] = name.split(':');
    const exported = this.exportedDurations.get(base!);
    if (exported)
      exported.observe(
        base === 'database_query_duration_ms'
          ? { operation: operation ?? 'OTHER' }
          : {},
        durationMs / 1000,
      );
    const current = this.durations.get(name) ?? {
      count: 0,
      sumMs: 0,
      maxMs: 0,
      buckets: bounds.map(() => 0),
    };
    current.count++;
    current.sumMs += durationMs;
    current.maxMs = Math.max(current.maxMs, durationMs);
    bounds.forEach((bound, index) => {
      if (durationMs <= bound)
        current.buckets[index] = (current.buckets[index] ?? 0) + 1;
    });
    this.durations.set(name, current);
  }
  snapshot() {
    return {
      counters: Object.fromEntries(this.counters),
      histograms: Object.fromEntries(
        [...this.durations].map(([name, item]) => [
          name,
          {
            ...item,
            buckets: Object.fromEntries(
              bounds.map((bound, index) => [bound, item.buckets[index]]),
            ),
          },
        ]),
      ),
    };
  }
}
export const metrics = new Metrics(true);
