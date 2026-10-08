# Development

## Prerequisites

- Node.js 24 LTS and npm 11.
- Docker Engine or Docker Desktop with Compose v2 for local PostgreSQL.
- Available ports 3000, 5173, and 55433, or updated configuration.

## Setup

From the repository root:

```sh
npm ci
cp .env.example .env
npm run db:up
npm run db:doctor
npm run db:migrate
npm run db:seed
npm run db:check
npm run dev
```

The root `.env` is ignored. Its sample credentials are for local development; use appropriate secrets for other environments. Development and start scripts load `.env` explicitly. Production process managers can inject environment variables and run `node server/dist/server.js` directly. Migrations and seeding are separate commands.

| Variable             | Purpose                                                                     |
| -------------------- | --------------------------------------------------------------------------- |
| `NODE_ENV`           | `development`, `test`, or `production`; defaults to development             |
| `PORT`               | HTTP port from 1 to 65535; defaults to 3000                                 |
| `CLIENT_ORIGIN`      | Required frontend HTTP origin without a path or trailing slash              |
| `DATABASE_URL`       | PostgreSQL connection URL; required for catalog/content/database operations |
| `POSTGRES_USER`      | Compose database role                                                       |
| `POSTGRES_PASSWORD`  | Compose database password                                                   |
| `POSTGRES_DB`        | Compose database name                                                       |
| `POSTGRES_HOST_PORT` | Published PostgreSQL port; defaults to 55433; container remains on 5432     |
| `API_PROXY_TARGET`   | Optional Vite development API target; otherwise derived from PORT           |
| `VITE_API_BASE_URL`  | Public build-time API URL in `client/.env`; defaults to same origin         |
| `TEST_DATABASE_URL`  | Optional dedicated disposable PostgreSQL database for integration tests     |

Set `POSTGRES_HOST_PORT=55433` and use `DATABASE_URL=postgresql://cloudops:<existing-password>@127.0.0.1:55433/cloudops`. Preserve the existing password. Keep the URL user/password/database consistent with `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`. Changing Compose credentials does not change roles in an already initialized volume. The optional database URL preserves standalone health operation; catalog calls return 503 when no database is configured.

## PostgreSQL

Compose uses the official PostgreSQL 17 Alpine image, a persistent named volume, loopback port publishing, and a health check.

```sh
docker compose --env-file .env ps
npm run db:down
```

Stopping Compose preserves data. See [database](database.md) for migrations, seeds, constraints, and indexes. Seeds restore canonical development records and are rejected outside `NODE_ENV=development`.

## Application workflows

Frontend: `http://localhost:5173`. API: `http://localhost:3000`.

- `/`: project home and API health.
- `/products`: server-filtered product list.
- `/products/:id`: product detail.
- `/admin/products`: create, edit, and confirmed deletion.
- `/content`: published content, search, sorting, and pagination.
- `/content/:slug`: published content detail, rendered as escaped text.
- `/admin/content`: editorial CRUD, publish, and archive.

```sh
npm run dev -w server
npm run dev -w client
```

Vite proxies `/api` to Express. The client uses loading/error/empty states, retries, request cancellation, and controlled forms. Backend validation remains authoritative. Administrative operations require cookie authentication, session-bound CSRF and permissions.

See [Headless CMS](headless-cms.md) for Content API contracts and [Operations](operations.md) for liveness, readiness, diagnostics, and port isolation.

## REST API

| Method | Endpoint               | Success                                          |
| ------ | ---------------------- | ------------------------------------------------ |
| GET    | `/api/v1/health`       | 200, process liveness                            |
| GET    | `/api/v1/categories`   | 200, `{ data: Category[] }`                      |
| GET    | `/api/v1/products`     | 200, `{ data: Product[], pagination }`           |
| GET    | `/api/v1/products/:id` | 200, `{ data: Product }`                         |
| POST   | `/api/v1/products`     | 201 with Location header and `{ data: Product }` |
| PATCH  | `/api/v1/products/:id` | 200, `{ data: Product }`                         |
| DELETE | `/api/v1/products/:id` | 204, no body                                     |

Errors use `{ error: { code, message, requestId } }`. Invalid identifiers/inputs return 400, missing products 404, duplicate product slugs 409, and unexpected failures a safe 500. Product responses include categoryId and category identity/name/slug; timestamps are ISO strings.

List query parameters:

| Parameter    | Accepted values/default                                       |
| ------------ | ------------------------------------------------------------- |
| `page`       | Positive integer, default 1, maximum 1,000,000                |
| `limit`      | Positive integer, default 10, maximum 100                     |
| `search`     | Literal substring in name/description, at most 200 characters |
| `categoryId` | UUID                                                          |
| `status`     | DRAFT, ACTIVE, INACTIVE                                       |
| `sort`       | createdAt, name, price; default createdAt                     |
| `order`      | asc, desc; default desc                                       |

Unknown query/body properties and repeated query parameters are rejected. Pagination includes page, limit, total, and totalPages. An empty collection has totalPages 0; requesting a page past the end returns an empty data array with the actual total.

```sh
curl -i http://localhost:3000/api/v1/health
curl -i http://localhost:3000/api/v1/categories
curl -i 'http://localhost:3000/api/v1/products?page=1&limit=10&status=ACTIVE&sort=price&order=asc'
curl -i -X POST http://localhost:3000/api/v1/products \
  -H 'Content-Type: application/json' \
  -d '{"name":"Travel Keyboard","slug":"travel-keyboard","description":"Compact keyboard","price":"49.95","status":"DRAFT","categoryId":"33333333-3333-4333-8333-333333333333"}'
```

Create requires name, slug, price, status, and categoryId. Description is optional/nullable. PATCH accepts only those fields and requires at least one. Omitted fields are preserved; description null clears it. Prices must be decimal strings, not JSON numbers.

## Quality and testing

```sh
npm run format
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Backend coverage includes health/errors, catalog HTTP contracts using injected services, business rules, validation, SQL parameterization, persistence-error translation, transactions, and migration lifecycle. `npm run test:unit` runs the configuration, validation, service, repository-contract, transaction, and migration-lifecycle tests without network sockets. HTTP tests require local socket permissions. PostgreSQL integration tests require an explicitly configured dedicated test database and otherwise skip.

```sh
TEST_DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:55433/cloudops_test npm test
```

Workspace commands remain available:

```sh
npm run typecheck -w client
npm run typecheck -w server
npm run build -w client
npm run build -w server
npm run start -w server
npm run preview -w client
```

Build outputs are `client/dist` and `server/dist`. Deploy `server/migrations` with server artifacts for compiled migration commands. Vite preview does not use the development proxy; production hosting must provide SPA fallback and `/api` routing, or set `VITE_API_BASE_URL` at build time and configure CLIENT_ORIGIN accordingly. Do not place secrets in frontend environment variables.

SIGTERM and SIGINT initiate bounded HTTP and pool shutdown. A shutdown exceeding ten seconds exits unsuccessfully.

## Activity development

DynamoDB Local publishes `127.0.0.1:58000` to its internal port 8000; PostgreSQL remains on `127.0.0.1:55433`. Add AWS_REGION, DYNAMODB_ENDPOINT, DYNAMODB_ACTIVITY_TABLE, DYNAMODB_HOST_PORT, OUTBOX_POLL_INTERVAL_MS, and OUTBOX_BATCH_SIZE from .env.example. Local dummy credentials are supplied in code; real AWS credentials are not needed. Production omits DYNAMODB_ENDPOINT.

Run `npm run dynamodb:up`, `npm run dynamodb:init`, `npm run dynamodb:check`, then `npm run worker:outbox` in a separate process. The worker is not silently started by npm run dev. `/admin/activity` supports recent and per-entity activity with cursor pagination. [Events](events.md) documents retry, idempotency, integration test configuration, and initialization. Database migrations must run before starting the API/worker.

## Authentication and administrator setup

Set DEV_ADMIN_EMAIL and a private DEV_ADMIN_PASSWORD (12–128 characters, at most 256 UTF-8 bytes) in the ignored local .env before running db:seed. Do not commit credentials. Apply migration 004_users_sessions.sql through db:migrate first. The seed creates a deterministic ADMIN, preserves unchanged hashes, and revokes sessions when its configured password changes; it never runs in production.

SESSION_LIFETIME_HOURS defaults to 8 and is bounded to 1–24. ENABLE_API_DOCS can be true/false; omit it for development-default enabled and production-default disabled. The example explicitly disables docs, so set it to true locally to use /api/docs. Production must omit DYNAMODB_ENDPOINT, use HTTPS, and supply credentials through the environment/SDK provider chain.

Visit /login, then the protected /admin pages. /admin/users is ADMIN-only; /account supports password changes. Development cookies work over localhost HTTP; keep frontend/API on a consistent hostname. Public catalog/CMS reads remain available without login. See [security](security.md) for CSRF, role mapping and deployment behavior, and [API](api.md) for OpenAPI contracts. Install declared Helmet, express-rate-limit and AWS SDK packages with npm install before typechecking/building; regenerate the lockfile where registry access is available.

## Performance workflows

Install declared dependencies with npm install where registry access is available; this also refreshes package-lock.json. npm run redis:up starts only the project Redis at 127.0.0.1:56379. npm run db:seed:performance generates a separate bounded development dataset; npm run db:explain records real query plans. npm run test:client runs Vitest/React Testing Library. k6 scripts are under load-tests/ and require a separately installed k6 binary. See [performance](performance.md) for comparable baseline/optimized/cache runs, safe rate-limit controls and unavailable measurements.
