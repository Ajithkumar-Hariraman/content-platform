# Architecture

## Current implementation

Two independently built npm workspaces contain the React client and Express API. Both use strict TypeScript, including exact optional property types. Root scripts coordinate development, quality checks, and database commands.

```text
React ProductPage
  -> typed API client
  -> Express request logging / CORS / JSON parsing
  -> product route
  -> ProductController (request validation and HTTP response)
  -> ProductService (business rules and application errors)
  -> ProductRepository (parameterized SQL and row mapping)
  -> PostgreSQL
```

Responses return through the repository, service, and controller into React state and the rendered product view. Category reads use the same route/controller/service/repository boundaries.

## Backend boundaries

`app.ts` constructs Express without listening side effects and accepts catalog services. `server.ts` validates configuration, creates the optional database pool and catalog composition, owns listening and process signals, and closes resources during shutdown. Missing database configuration leaves health available and returns 503 for catalog requests. An unavailable configured database causes catalog requests to fail safely through centralized error handling.

Controllers validate identifiers, bodies, and queries with Zod, delegate business work, and assign HTTP status codes. Product creation verifies the referenced category. Updates verify product existence and a changed category; affected-row results also handle concurrent deletion. PostgreSQL foreign keys enforce integrity if a category disappears between validation and a write. Product and Content writes now pair the domain mutation with an outbox insert in one transaction; see [events](events.md).

Repositories contain explicit SQL and no HTTP decisions. Known slug and category constraint violations become persistence errors; the service translates them into safe application errors. Unexpected errors retain their diagnostic information for server-side centralized logging. No generic repository or DI framework is used.

Collection reads execute one SQL statement with filtered rows, a page, and a total count. This preserves count/page consistency within a statement snapshot, including requests beyond the final page. Sort identifiers come from a fixed mapping and ordering ties use the product UUID. Values use bound parameters; search escapes LIKE wildcards. This is a correctness-oriented baseline, not a tuned search implementation.

## Client boundaries

The home page retains process-health monitoring. `/products` browses the catalog; `/admin/products` adds create, edit, and confirmed deletion. React Router owns navigation, nested application layout, detail parameters, and back/forward navigation. Routes include `/`, `/products`, `/products/:id`, `/content`, `/content/:slug`, `/admin/products`, and `/admin/content`.

`ProductPage` coordinates data loading, cancellation, refreshes, and mutation notices. Filters, the result table/pagination, and the controlled form are separate components. Backend filtering and pagination determine displayed rows. Requests have ten-second timeouts; reads are aborted on dependency changes and unmount. Mutation completion refreshes the list without a page reload, and deleting the last row of a page moves to an available page.

The API utility owns fetch, JSON parsing, error messages, cancellation, and typed methods. Prices remain decimal strings in forms and transport. The client and server own their contract types independently; no server implementation enters the browser bundle.

Vite proxies `/api` during development. Production frontend hosting must provide SPA route fallback and route `/api` to the backend, or build with a public `VITE_API_BASE_URL`. Frontend configuration must not contain secrets.

## Data responsibilities

PostgreSQL is the transactional system of record for Categories, Products, Content, and outbox delivery intent. Relational constraints and exact numeric prices enforce integrity. SQL migrations and the development seed are explicit commands, separate from application startup. See [database](database.md) for schema, constraints, indexes, and pool responsibilities.

DynamoDB stores append-oriented activity/audit events delivered from the PostgreSQL transactional outbox. It does not mirror domain CRUD records. The worker provides retryable, idempotent delivery; see [events](events.md).

## Runtime operations

Completed requests emit structured JSON logs with request identifier, method, path, status, and duration. Incoming identifiers are bounded and validated; other requests receive UUIDs. Query strings are excluded from request logs. Client error responses contain a safe error envelope and request ID, with no SQL, constraint details, or stack trace. Unexpected failures are logged server-side.

SIGTERM and SIGINT stop new HTTP work, finish active requests, and close the pool. A ten-second shutdown deadline exits unsuccessfully if work stalls. Health identifies process availability, not database readiness; `/live` and `/ready` remain deferred.

The API disables Express identification headers, limits JSON to 100 KB, and configures CORS for one frontend origin. Administrative requests require PostgreSQL-backed sessions, session-bound CSRF tokens and centralized permissions. Public Product and Content reads remain accessible without authentication.

## Phase 7 AWS deployment

```text
Browser -> CloudFront -> private S3 (React)
                     -> /api/* -> ALB -> Fargate (Express) -> private RDS PostgreSQL
                                       Fargate outbox worker -> DynamoDB
```

The production Docker image, Terraform stacks, scoped IAM, Secrets Manager injection, CloudWatch logs, migration task and AWS scripts are implemented. The demo uses no NAT Gateway, Single-AZ RDS, one API task and one outbox worker when enabled, and short log retention. AWS provisioning and live verification remain pending. See [AWS architecture](aws-architecture.md) and [deployment](aws-deployment.md). ElastiCache, autoscaling, Prometheus/Grafana, Lambda and GitHub Actions remain deferred.

## Headless CMS

Admin React portal -> admin route -> Zod validation -> ContentController -> ContentService -> ContentRepository -> PostgreSQL. Public React pages use public routes through the same service/repository boundary. The backend owns content and lifecycle; React owns presentation. Controllers handle HTTP and validation, services enforce lifecycle, and repositories implement explicit parameterized SQL.

Creation always produces a draft. Editing accepts editorial fields only. Publishing permits draft/published states and preserves the original publication timestamp; an atomic SQL predicate protects against a concurrent archive. Archiving is idempotent and immediately removes public visibility. Archived content is terminal in Phase 3; there is no restore operation. Public list and slug queries always constrain status to PUBLISHED in SQL.

NotificationContext stores only dismissible success/error/info messages. Product and Content server data stays in page state. Controlled forms receive typed data and callbacks through props. useDebouncedValue delays search requests and cleans up timers. Effects abort obsolete reads and check cancellation before changing state. Detail pages render text through React escaping; no untrusted HTML is injected.

## Health and operations

Liveness performs no dependency calls. Readiness invokes an injected connectivity check backed by the shared pg pool and SELECT 1; unavailable/unconfigured dependencies yield 503. The pool bounds connections, acquisition timeout, statement timeout, and idle lifetime. Signal handling drains HTTP, closes the pool, and enforces a ten-second shutdown deadline.

Request logs contain requestId, method, path, statusCode, and durationMs. Central errors expose only safe API messages and correlation identifiers. Internal diagnostics redact PostgreSQL URLs and configured passwords. No request bodies or authorization headers are logged.

Optional Redis and local performance tooling are implemented in Phase 6. Production containers and ECS/Fargate/RDS Terraform are implemented in Phase 7; see the AWS deployment workflow above. CI/CD and Lambda remain deferred.

## Phase 4 event boundary

PostgreSQL owns domain state and the transactional outbox. Product/Content repository writes use a shared withOutbox helper backed by inTransaction and one pg client. The outbox worker delivers bounded batches to a dedicated DynamoDB ActivityRepository and records acknowledgement/retry metadata. API requests contain no DynamoDB writes. ActivityController validates cursor/filters, ActivityService handles application errors, and ActivityRepository performs DynamoDB reads. React ActivityPage consumes this read store independently of Product/Content state.

See [events](events.md) for keys, eventual consistency, retry semantics, crash recovery, actor contracts, and local operation. PostgreSQL remains the only readiness dependency for the core API.

## Phase 5 security boundary

Express hardening/request logging -> bounded input -> authentication -> Origin/CSRF checks -> central permission guard -> validation/controller -> service -> repository/parameterized SQL. Public reads bypass session requirements. UserRepository owns PostgreSQL users/sessions, session lookup/revocation and locked access changes; AuthService owns credential verification and session token generation. Controllers own cookie transport and safe public responses.

AuthProvider stores the current public user, permissions and CSRF token; NotificationProvider remains independent. RequireAuth protects admin routes and AccountPage provides password change. User administration is guarded by USER_READ/USER_WRITE. Request-scoped actor identity flows into the existing transactional outbox without adding credential fields. OpenAPI contracts are served by an explicitly gated documentation router. See [security](security.md) and [API](api.md).

## Performance boundaries

TanStack Query owns fetched Product/Category/Content/Activity/User records; contexts retain authentication and notifications. Public reads use Redis cache-aside with PostgreSQL transactionally advanced generation keys. Redis remains optional for readiness. PostgreSQL is consulted for cache generations to prevent stale publication visibility after failed invalidation delivery. Bounded process-local metrics and ADMIN-only diagnostics support experiments. Phase 6 introduces no speculative read indexes; Phase 7 deploys with Redis caching disabled. See [performance](performance.md).
