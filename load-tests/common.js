import http from 'k6/http';
import { check, sleep } from 'k6';
export function numberSetting(name, fallback, minimum = 1) {
  const value = Number(__ENV[name] ?? fallback);
  if (!Number.isFinite(value) || value < minimum)
    throw new Error(`Invalid ${name}`);
  return value;
}
export const thresholds = {
  http_req_failed: [
    `rate<${numberSetting('MAX_FAILURE_RATE', 0.01, 0.000001)}`,
  ],
  checks: ['rate>0.99'],
  http_req_duration: [`p(95)<${numberSetting('P95_MS', 250)}`],
  dropped_iterations: ['count==0'],
};
export const trendStats = ['avg', 'min', 'med', 'max', 'p(95)', 'p(99)'];
export function exercise() {
  const base = (__ENV.BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
  const slug = __ENV.CONTENT_SLUG ?? 'perf-content-1';
  for (const [path, name, list] of [
    [
      '/api/v1/products?page=1&limit=20&sort=createdAt&order=desc',
      'products',
      true,
    ],
    [
      '/api/v1/content?page=1&limit=20&sort=publishedAt&order=desc',
      'content',
      true,
    ],
    [`/api/v1/content/${encodeURIComponent(slug)}`, 'content-detail', false],
  ]) {
    const response = http.get(`${base}${path}`, {
      tags: { name },
      timeout: '5s',
    });
    check(response, {
      'status is 200': (response) => response.status === 200,
      'response contract': (response) => {
        try {
          const data = response.json('data');
          return list
            ? Array.isArray(data)
            : data !== null && typeof data === 'object';
        } catch {
          return false;
        }
      },
    });
  }
}
export function pacedExercise() {
  exercise();
  sleep(numberSetting('THINK_SECONDS', 0.5, 0));
}
export function summarize(data) {
  const label = __ENV.EXPERIMENT ?? 'baseline';
  const run =
    __ENV.RUN_ID ?? new Date().toISOString().replace(/[^a-zA-Z0-9]/g, '');
  if (
    !/^(baseline|optimized|redis)$/.test(label) ||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(run)
  )
    throw new Error('Invalid experiment label or run identifier');
  const values = (name) => data.metrics?.[name]?.values ?? {};
  const duration = values('http_req_duration');
  const summary = {
    recordedAt: new Date().toISOString(),
    experiment: label,
    run,
    requestRate: values('http_reqs').rate ?? null,
    p50Ms: duration.med ?? null,
    p95Ms: duration['p(95)'] ?? null,
    p99Ms: duration['p(99)'] ?? null,
    failureRate: values('http_req_failed').rate ?? null,
    raw: data,
  };
  return {
    [`docs/performance/${label}-${run}.json`]: JSON.stringify(summary, null, 2),
    stdout: JSON.stringify({ ...summary, raw: undefined }, null, 2) + '\n',
  };
}
