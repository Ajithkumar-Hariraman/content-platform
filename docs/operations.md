# Operations

## Health endpoints

| Endpoint             | Responsibility                                 | Result                     |
| -------------------- | ---------------------------------------------- | -------------------------- |
| /api/v1/health/live  | Process/application alive; no dependency query | 200                        |
| /api/v1/health       | Compatibility alias for liveness               | 200                        |
| /api/v1/health/ready | PostgreSQL connectivity through pool SELECT 1  | 200 ready or 503 NOT_READY |

Readiness flow: GET ready -> health router -> injected checkConnection -> pg pool -> SELECT 1 -> 200. Missing configuration, connection/authentication errors, or timeouts return a safe 503 with requestId. Liveness remains successful independently. Readiness confirms database connectivity; migrations remain an explicit deployment prerequisite and readiness does not validate schema versions. Connection acquisition and SQL statements have five-second limits.

These endpoints provide distinct process and traffic-readiness signals for future container orchestration and load balancing; those services are not deployed yet.

## Local ports and isolation

| Service            | Local endpoint  | Container port    |
| ------------------ | --------------- | ----------------- |
| API                | localhost:3000  | Not containerized |
| React/Vite         | localhost:5173  | Not containerized |
| Project PostgreSQL | 127.0.0.1:55433 | 5432              |

The developer machine already uses 5432 (local PostgreSQL), 5433 and 55432 (other Docker projects). Leave those services untouched. Compose publishes `127.0.0.1:${POSTGRES_HOST_PORT:-55433}:5432`. Set POSTGRES_HOST_PORT=55433 and DATABASE_URL host/port to 127.0.0.1:55433. URL user/password/database must match POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB; do not rotate existing credentials when fixing a port.

## Diagnostics and recovery

```sh
npm run db:up
docker compose --env-file .env up -d --wait --wait-timeout 60 postgres
docker compose --env-file .env ps postgres
npm run db:doctor
npm run db:migrate
npm run db:seed
npm run db:check
```

The pg_isready Compose healthcheck tests server availability using the configured role/database. db:doctor reports configured host/port, TCP success, and authenticated PostgreSQL query success, never the password. It exits unsuccessfully when authentication/connectivity fails. Database commands perform a connectivity check before their operation and provide a diagnostic instruction if unavailable.

- Port binding failure: confirm the project mapping and URL use 55433; update both if selecting another isolated port. Do not stop another project to free its port.
- Docker socket permission denied: run project commands from a shell with existing Docker access. Restricted Codex runtime access does not establish whether PostgreSQL works on the developer machine.
- TCP failure: inspect only this Compose project's postgres service and health state; ensure Docker is running and the loopback mapping exists.
- TCP succeeds, authentication fails: verify URL credentials/database against the original initialized volume. POSTGRES variables only initialize a fresh volume; changing them does not rotate existing roles.
- Missing schema: run db:migrate. Checksum failures require recovering the original applied migration, not editing migration history.
- Seed failure outside development: seeding deliberately requires NODE_ENV=development. Repeated seeding restores canonical records without removing unrelated data.

To recover a failed container after changing the mapping, use `docker compose --env-file .env up -d --force-recreate postgres`. This targets this project's service and retains its named volume. Do not run broad Docker cleanup or remove volumes to repair a host-port mismatch. No volume deletion is required by this change.

## Shutdown and logs

SIGTERM/SIGINT stop accepting HTTP requests, drain active requests, then close the PostgreSQL pool. A ten-second deadline closes remaining connections and exits with failure. Shutdown start/completion/failure events are structured JSON.

Request events contain requestId, method, path, statusCode, durationMs. A validated incoming x-request-id is propagated or a UUID is generated. API errors include the same requestId; unexpected details remain internal. Diagnostic messages redact PostgreSQL URLs and configured database passwords. Request bodies, authorization headers, and secrets are not logged.

Admin endpoints require session authentication, central permissions, and CSRF for mutations. See security.md for HTTPS cookies, rate limits, proxy boundaries and administrator setup. Production SPA hosting must provide route fallback and route /api to the backend. No AWS or production hosting configuration is included in Phase 3.

## Activity delivery

DynamoDB Local uses its own Compose service and volume at `127.0.0.1:${DYNAMODB_HOST_PORT:-58000}:8000`. `npm run dynamodb:up` touches only that service. Initialization/check commands and the separate outbox worker are described in [events](events.md). No unrelated containers or volumes need to be altered.

DynamoDB failure does not change PostgreSQL readiness or prevent committed domain changes. Pending events retry with bounded exponential backoff; the activity read endpoint returns 503 during store outages. Worker logs report attempts and delivery duration with event identifiers. Inspect pending count/age and repeated failures separately from API health. SIGTERM/SIGINT stop polling and abort SDK requests while retaining pending delivery intent.

## Performance diagnostics

Redis uses project host port 56379 and is optional for readiness. Cache failures log safe operation names and fall back to PostgreSQL. ADMIN-only /api/v1/admin/diagnostics/performance provides process-local metrics and non-secret pool/resource counts. Slow request logs use configurable SLOW_REQUEST_THRESHOLD_MS. PERFORMANCE_MODE is development-only; it never removes authentication controls. See [performance](performance.md).

## Application observability

See [observability](observability.md) for the internal Prometheus listener, optional local Grafana dashboard, OpenTelemetry preload configuration, ECS sidecar boundary and troubleshooting workflow. Request logs now use route templates rather than raw paths and include trace/span IDs when available. Metrics and trace exporter failures do not affect API readiness or normal request handling. Each API/worker process requires its own scrape target; the metrics listener accepts loopback only and must never be added to the public ALB.
