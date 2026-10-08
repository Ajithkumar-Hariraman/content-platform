# Performance engineering

## Measurement boundary

PostgreSQL remains authoritative. Redis caches public Product and published Content reads; DynamoDB remains the activity read store. TanStack Query owns React server state with centralized keys, abortable queries, explicit mutation invalidation, bounded staleness and principal-scoped administrative keys. AuthContext and NotificationContext retain their existing responsibilities. Route modules load lazily under a Suspense boundary. Search waits for the debounced value before starting a query; filters reset pagination and deleted last-page items clamp to an existing page.

## Local services and controls

PostgreSQL: 127.0.0.1:55433. DynamoDB: 127.0.0.1:58000. Redis: 127.0.0.1:56379, configurable with REDIS_HOST_PORT and REDIS_URL. Redis uses a disposable bounded 128 MB cache with allkeys-lru eviction. Only project services are started; no host service or unrelated container is modified.

Run npm install, npm run db:up, npm run redis:up and npm run db:migrate. DB_POOL_MAX defaults to 10; DB_POOL_IDLE_TIMEOUT_MS to 30000; DB_POOL_CONNECTION_TIMEOUT_MS to 5000. Queries retain a 5000 ms statement timeout. Defaults provide a starting point, not a capacity recommendation. Pool total/idle/waiting/max counts are exposed only to administrators.

## Cache correctness

Cache-aside applies only to public lists and details. Keys contain a schema prefix, domain, PostgreSQL generation, operation and SHA-256 digest of normalized explicit filters or identifier. Search text, credentials and arbitrary request objects are not stored in key names. Lists include page, limit, order, sort and supported filters. Admin reads/mutations, users and sessions bypass Redis. CACHE_ENABLED=false permits baseline runs; no Redis URL also disables caching.

Migration 005 introduces one generation row per domain. PostgreSQL statement triggers advance the appropriate generation atomically with Product/Content mutations and category changes. This makes prior list/detail keys unreachable after a commit even if Redis was unavailable during the write, across API instances and for direct SQL writes. Transaction rollback rolls back generation changes too. Old namespaces expire after CACHE_TTL_SECONDS (default 60); invalidation does not require scanning Redis or deleting unrelated keys. Trigger overhead and contention on each domain generation row should be included in write benchmarks. No-op SQL statements can rotate a generation harmlessly.

Each cached request reads the small PostgreSQL generation row before Redis lookup. This deliberately preserves database authority and trades one cheap PostgreSQL query for avoiding larger list/join/count/body queries. A miss checks the generation again before SET, avoiding population from an obsolete in-flight snapshot. Reads concurrent with a write can complete with their earlier snapshot; reads initiated after its commit use the new namespace. Redis errors bypass caching and load from PostgreSQL; failed domain reads are never cached. The Redis client caps its command queue at 1024, disables offline queuing, bounds command waits to CACHE_TIMEOUT_MS (150 by default), reconnects with bounded backoff and rate-limits safe failure logs. Core readiness still checks PostgreSQL only.

## Representative dataset and query plans

npm run db:seed:performance generates 20 deterministic categories, 20000 products and 2000 content records by default. PERFORMANCE_PRODUCTS and PERFORMANCE_CONTENTS control bounded sizes. It uses separate perf-prefixed records and never runs as part of normal seeding. Repeated runs upsert the generated range; reducing counts does not remove previously generated records. It requires NODE_ENV=development, leaves users unchanged and ANALYZEs tables. Direct bulk generation intentionally does not create thousands of activity events.

npm run db:explain records baseline EXPLAIN (ANALYZE, BUFFERS, SETTINGS) plans for the actual production product list/search/category+status and public content list/slug queries under docs/performance/. Every artifact includes SQL, bound values, PostgreSQL version, cardinalities and recording time. EXPLAIN_VARIANT=candidate npm run db:explain also evaluates filtered AS NOT MATERIALIZED in list queries; this is an experiment, not a shipped optimization. The candidate may duplicate predicate work while avoiding wide CTE materialization. Compare wall-clock execution, shared buffers, sort/memory behavior and representative filters before deciding.

Existing primary/unique slug indexes, products_category_id_idx and contents_public_published_idx are retained. No additional read-performance indexes have been added without executable query-plan evidence. Candidate indexes for category/status/order or trigram search must be justified by measured plans, selectivity and mutation overhead before adding a migration. PostgreSQL cache-generation primary keys are correctness infrastructure, not speculative query tuning.

## Repeatable experiments

Use a dedicated development database and a quiet host. Record git revision where available, Node/PostgreSQL/Redis/k6 versions, hardware, pool settings, dataset cardinalities and rate-limit/cache settings. Capture at least three comparable runs per experiment and distinguish warm and cold cache behavior; do not label a process restart or different dataset as an optimization.

1. Baseline: CACHE_ENABLED=false and PERFORMANCE_MODE=true in development. Start the API, record baseline plans, warm with k6 run load-tests/smoke.js, then run k6 run -e EXPERIMENT=baseline -e RUN_ID=run1 load-tests/baseline.js from the repository root.
2. Optimized: after a measured query/index change, regenerate plans and repeat the same run with EXPERIMENT=optimized, caching still disabled. The candidate-only EXPLAIN command does not change API queries and cannot by itself establish an optimized HTTP benchmark.
3. Redis: set CACHE_ENABLED=true, start project Redis, restart API and repeat warmup plus the same run with EXPERIMENT=redis. For a cold measurement rotate the project generation through a dedicated performance reseed; never use FLUSHALL or broad Redis cleanup commands.

PERFORMANCE_MODE=true disables only the general API rate limiter and is rejected outside development. Authentication limits and all permissions/CSRF stay enabled. Otherwise load tests will correctly report 429s against the standard 120/minute/IP limit. Never use performance mode on a shared public server.

Load scripts cover product list, public content list and a known published detail (CONTENT_SLUG defaults to perf-content-1). BASE_URL defaults to the local API. smoke uses one VU for 10 seconds; baseline uses 20 iterations/second for 120 seconds, each issuing three requests; stress increases VUs; spike introduces a sharp increase and recovery. These are configured target workloads, not measured throughput. ITERATIONS_PER_SECOND, MAX_VUS, DURATION (smoke/baseline), P95_MS and MAX_FAILURE_RATE are configurable. Default thresholds: failure rate <1%, checks >99%, p95 <250 ms, zero dropped iterations. Request-contract checks distinguish successful pages from safe error responses.

Each k6 handleSummary writes a timestamped experiment JSON artifact with raw metrics plus request rate, p50/p95/p99 and failure rate. Unknown summary fields remain null rather than fabricated values. Verify these fields against the installed k6 version before comparison. Files are generated only from completed runs. Keep all repetitions; do not replace slower runs selectively.

## Application correlation

GET /api/v1/admin/diagnostics/performance requires an authenticated ADMIN permission (USER_WRITE) and returns bounded counter/histogram snapshots, pool counts, process memory and cumulative CPU microseconds. It is no-store and never returns connection strings or credentials. Capture snapshots immediately before and after each run using cookie authentication. Compare counter deltas: hit / (hit + miss), cache errors, query counts/duration, HTTP route/status histograms, pool waiting and process CPU deltas divided by elapsed wall time. Histogram buckets are cumulative milliseconds with count, sum and max; they are not exact percentile samples. Instrumentation remains process-local and resets on restart.

Database timings measure execution on acquired clients, including transaction queries, and exclude pool acquisition waits. Pool waiting gauges provide the corresponding saturation signal. HTTP timings measure completed responses by method, route template and status; unmatched requests share one label. Cache timings cover GET/parse and generation-check/SET respectively. SLOW_REQUEST_THRESHOLD_MS defaults to 500 and emits request ID, method, route, status and duration without bodies or secrets. No Prometheus/Grafana/OpenTelemetry deployment is introduced.

## Recorded execution status

See docs/performance/verification.json for actual command outcomes from this implementation environment. Registry DNS fails; dependency installation and lockfile regeneration are blocked. Docker socket access is denied, PostgreSQL connectivity fails and k6 is absent. No live EXPLAIN plans, HTTP latency/throughput measurements or before/after speedups are available. Baseline/candidate/Redis measurements remain pending; this document deliberately contains no invented performance results.

## References

[TanStack mutation invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations), [node-redis connection configuration](https://redis.io/docs/latest/develop/clients/nodejs/connect/), [k6 custom summaries](https://grafana.com/docs/k6/latest/results-output/end-of-test/custom-summary/).
