# Application observability

Structured logs describe individual requests and operational events. Prometheus metrics aggregate rates, durations and resource usage across requests. OpenTelemetry traces link the work performed within a request. Use the request ID to locate an individual request; sampled requests also carry `trace_id` and `span_id` for a trace backend. Unsampled requests can still have trace context, without an exported trace.

## Configuration and boundaries

Observability is disabled by default: `METRICS_ENABLED=false` and `OTEL_ENABLED=false`. Neither service is required for API availability. Metrics listener binding failures and tracing initialization/export failures do not stop the API. Collector outages lose telemetry after a bounded queue fills; they do not delay business requests. Traces use OTLP HTTP with a two-second export timeout and a bounded batch queue of 1,024 spans.

`METRICS_HOST` accepts only loopback addresses, defaulting to `127.0.0.1`; `METRICS_PORT` defaults to 9464. The separate listener serves only `GET /metrics`. The public API has no metrics route. In ECS awsvpc mode, run a scraper/collector sidecar in the same task network namespace and scrape localhost. Keep the metrics port out of ALB target groups, listener rules, CloudFront routes and security-group ingress. Existing API authentication, CSRF, permissions and security middleware are unchanged. This phase does not provision or modify AWS resources. If external scraping is needed later, design an authenticated private ingress explicitly; do not expose this listener publicly.

Use `METRICS_PORT=9465` for the separate outbox process, which owns independent process-local metrics. A port conflict only disables that listener. Scrape each API task and worker individually; metrics reset on process restart. Sum counter rates across replicas, and aggregate histogram buckets before computing quantiles. Do not average replica quantiles.

Set `OTEL_ENABLED=true`, `OTEL_SERVICE_NAME=content-platform-api` and `OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4318` to enable tracing. The base endpoint receives `/v1/traces`; `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` can override the complete URL. The exporter also supports standard `OTEL_EXPORTER_OTLP_HEADERS` for collector authentication; store these as secrets. Only OTLP HTTP is configured here. Use TLS for remote collectors. `OTEL_TRACES_SAMPLER_ARG` defaults to 0.1 and accepts a ratio from 0 to 1; parent sampling decisions are respected. Use a distinct worker service name. Standard npm dev/start/worker commands and the container command preload instrumentation before application imports. Direct invocation of server.js without the preload does not enable tracing.

Incoming HTTP, Express and PostgreSQL use established OpenTelemetry instrumentation and ESM loader hooks. Outbound HTTP and Redis auto-instrumentation are deliberately omitted: the current Redis v5 cache already records hit/miss/error and duration metrics, and tracing outbound AWS SDK calls could export business paths. DynamoDB keeps its existing integration and safe failure behavior. Trace export uses an explicit attribute allowlist (HTTP method/status and database system), generic span names, service name, timings and trace context. SQL, query values, raw URLs, user/database identities, exception events, status messages, links and process arguments are omitted. Headers, cookies and payloads are never recorded by request logging. Request paths in logs use templates; unmatched requests use `unmatched`.

## Local workflow

The optional Compose profile uses host networking for the existing host-run API. It is intended for Linux; Docker Desktop requires host networking support to be enabled. All observability listeners bind loopback. Normal `npm run dev` and database workflows remain independent.

```sh
# In .env: METRICS_ENABLED=true; keep METRICS_HOST=127.0.0.1
npm run dev
# In another terminal:
docker compose --env-file .env --profile observability up -d prometheus grafana
curl http://127.0.0.1:9464/metrics
# Optional worker scrape target:
METRICS_PORT=9465 npm run worker:outbox
```

Open Prometheus at http://127.0.0.1:59090 and Grafana at http://127.0.0.1:53000. Grafana provisions the Prometheus data source and Content Platform dashboard. Its initial local credentials are Grafana's default admin/admin; change the password on first login. Anonymous access is disabled. Stop just the optional services with `docker compose --env-file .env --profile observability stop prometheus grafana`. No collector or trace backend is included in this profile; point OTLP at an existing collector when traces are needed.

## Useful metrics

| Metric                                                     | Meaning                                                                                            |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `http_requests_total`                                      | Completed responses by method, route template and status class                                     |
| `http_request_duration_seconds`                            | Fixed-bucket response duration histogram with the same labels                                      |
| `http_requests_in_flight`                                  | Active requests; decremented when a connection closes                                              |
| `database_query_duration_seconds`                          | PostgreSQL query histogram by bounded SQL operation                                                |
| `database_slow_queries_total`                              | Queries at or above `SLOW_QUERY_THRESHOLD_MS` (default 250 ms)                                     |
| `cache_hit_total`, `cache_miss_total`, `cache_error_total` | Cache outcomes without keys or entity labels                                                       |
| `cache_get_duration_seconds`, `cache_set_duration_seconds` | Cache read/write duration                                                                          |
| `outbox_processed_total`                                   | Successful deliveries recorded after commit                                                        |
| `outbox_failed_total`                                      | Failed delivery attempts recorded after retry scheduling commits; not permanently abandoned events |
| `outbox_retried_total`                                     | Committed delivery attempts after the first attempt, successful or failed                          |
| `process_*`, `nodejs_*`                                    | Runtime CPU, memory, event loop, GC and process health                                             |

HTTP methods use a fixed allowlist and all other methods become `OTHER`. Routes come from Express templates, never original URLs; unmatched requests share one label. SQL operations use a fixed allowlist. There are no request IDs, SQL statements, users, session tokens or entity IDs in labels. Existing ADMIN performance diagnostics continue to expose their legacy counter/histogram snapshots through the shared registry; Prometheus is the operational metrics output.

Useful queries: `sum(rate(http_requests_total[5m]))` for request rate, `sum(rate(http_requests_total{status_class="5xx"}[5m]))` for server errors, and `histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))` for p95 response latency. Fixed buckets give estimates, not exact percentiles. No benchmark or latency claim is implied by these dashboards.

## Troubleshooting

1. Check liveness and readiness independently. PostgreSQL readiness failures indicate a core dependency problem; missing Redis or collector telemetry does not affect readiness.
2. If Prometheus reports a down target, check the metrics flag, loopback port, listener warnings and scraper network namespace. A down worker target is expected when the worker is not running.
3. For rising latency/errors, compare HTTP status-class rates, query histograms and slow-query counts. Then inspect cache errors/misses, runtime memory and in-flight work. Correlate individual safe request logs using the request ID or trace ID.
4. For delivery problems, compare outbox failed/retried rates with safe worker logs and pending age/count in PostgreSQL. A failed attempt remains pending under the existing retry policy; processed metrics do not imply exactly-once DynamoDB writes.
5. If traces are missing, confirm the preload command, enabled flag, sampling ratio, endpoint, protocol, collector authentication and collector/backend health. Test collector reachability from the API task. `tracing_disabled` reports a safe initialization reason; runtime export failures are contained without printing potentially sensitive exporter diagnostics. Verify ingestion at the collector. API availability is not evidence that trace delivery succeeded.
