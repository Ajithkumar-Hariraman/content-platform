# CloudOps Content Platform

A production-oriented reference platform for product and content operations, with explicit application boundaries and an incremental path to AWS deployment.

## Technology stack

React, strict TypeScript, Vite, Node.js, Express, PostgreSQL through `pg`, raw SQL migrations, Zod request validation, and Docker Compose. npm workspaces coordinate the client and server.

## Current features

- API health view and structured runtime logging with request identifiers.
- Category listing and complete Product REST CRUD.
- Headless CMS with separate admin/public APIs, draft/published/archived lifecycle, and database-enforced public visibility.
- React Router navigation, public content pages, editorial portal, debounced search, and typed global notifications.
- Separate process liveness and PostgreSQL readiness endpoints.
- Server-side product search, category/status filtering, deterministic sorting, and pagination.
- Product browsing at `/products` and controlled create/edit/delete forms at `/admin/products`.
- Validated configuration and requests, safe centralized errors, configured CORS, bounded JSON bodies, and graceful shutdown.
- PostgreSQL schema, checksum-tracked transactional migrations, repeatable development seed, and pool lifecycle management.

## Architecture

```text
React -> typed API client -> Express route -> controller
      -> service -> repository -> PostgreSQL
```

PostgreSQL is the transactional system of record. DynamoDB stores append-oriented activity events delivered through a PostgreSQL transactional outbox. PostgreSQL-backed authentication, role permissions, and CSRF protect administrative operations. Optional Redis caching supports local performance work. Phase 7 includes a production container, Terraform infrastructure, and AWS deployment scripts.

## Local setup

Use Node.js 24 LTS, npm 11, and Docker with Compose v2.

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

Open `http://localhost:5173`. The API listens on port 3000 by default. Set `POSTGRES_HOST_PORT=55433`; Node connects to `127.0.0.1:55433`, mapped to container port `5432`. Keep URL credentials consistent with the Compose variables. PostgreSQL is required for catalog and content operations. `/api/v1/health/live` (and compatibility `/health`) remains independent of it; `/health/ready` checks PostgreSQL. Product prices use decimal strings, for example `"129.99"`, in request and response JSON.

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

See [architecture](docs/architecture.md), [development](docs/development.md), and [database](docs/database.md) for boundaries, API contracts, configuration, and operational workflows.

Phase 3 workflows and endpoint contracts: [Headless CMS](docs/headless-cms.md). Runtime checks, local database recovery, and service ports: [Operations](docs/operations.md).

Phase 4 adds transactional Product/Content audit events, an independent retrying worker, DynamoDB Local commands, and `/admin/activity`. See [events](docs/events.md) for delivery guarantees and configuration. Install the AWS SDK dependencies with `npm install`, then run `npm run dynamodb:up`, `npm run dynamodb:init`, `npm run dynamodb:check`, and `npm run worker:outbox` alongside the API/client.

Phase 5 adds secure sessions, centralized permissions, user administration, password changes, security headers/rate limits and development OpenAPI docs. Set private development administrator credentials before seeding. See [security](docs/security.md) and [API](docs/api.md).

Phase 6 adds TanStack Query server state, lazy routes, Redis public-read caching, transactional cache generations, bounded performance metrics and dataset/EXPLAIN/k6 workflows. See [performance](docs/performance.md) for methodology, actual execution status and pending measurements.

Phase 7 adds private S3/CloudFront hosting, ALB, ECS/Fargate API and outbox worker, private RDS, DynamoDB, ECR, scoped IAM, Secrets Manager injection, CloudWatch logs, and an isolated migration task. See [AWS architecture](docs/aws-architecture.md) and [AWS deployment](docs/aws-deployment.md) for the existing Terraform and preflight/build/deploy/smoke workflow. AWS provisioning and live verification remain pending; the infrastructure files alone do not establish a deployed environment.
