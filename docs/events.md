# Activity events

PostgreSQL owns Product/Content state and durable delivery intent. DynamoDB owns the activity read model. A request never writes directly to both stores: that would leave a successful domain mutation without an audit event when DynamoDB fails, or an event describing an uncommitted mutation.

## Atomic mutation boundary

Product/Content repositories borrow one pg client, begin a transaction through the existing inTransaction helper, mutate the domain row, insert an outbox event, and commit. withOutbox is a small helper for that transaction boundary; it introduces no UnitOfWork framework. Both writes use the same client. Domain or outbox failure rolls back both. Validation, missing rows, slug conflicts, and invalid lifecycle transitions produce no event.

Create, update, delete, publish, and archive emit the corresponding PRODUCT_* or CONTENT_* event. Content publish/archive lock the row while examining its state, so repeated operations produce no new transition event, including concurrent requests. Domain lifecycle decisions remain in ContentService; row predicates and locks enforce them against races. Seeds are deterministic development maintenance, not a source of historical activity or a backfill mechanism.

Events contain a UUID, eventType, entityType, entityId, occurredAt, actor, and bounded data. Data contains only a slug, resulting status, or changed field names; bodies, descriptions, full snapshots, credentials, and request headers are excluded. Authenticated HTTP mutations use actor.kind USER and the verified user UUID through request-scoped context. System operations use SYSTEM. Historical ADMIN_PORTAL events remain readable; no current code invents user identities.

## Delivery and failure lifecycle

```text
API -> service -> PostgreSQL BEGIN -> domain mutation + outbox INSERT -> COMMIT
    -> worker -> DynamoDB conditional Put -> outbox processed_at
```

outbox_events includes identity/type/entity, JSONB event payload, occurred timestamp, processed_at, attempt_count, last_error, and next_attempt_at. A partial index on (next_attempt_at, created_at, id) for unprocessed rows supports eligible polling. There are no speculative indexes. Outbox rows are retained after processing; no retention deletion is automated.

The worker processes a configured limited batch, waits between polls, and handles one locked event per PostgreSQL transaction. FOR UPDATE SKIP LOCKED permits multiple workers without simultaneous ownership. The database lock spans the bounded DynamoDB request and its acknowledgement. This trades a short-lived database connection/row lock for simple crash recovery; there is no lease expiry or stale owner problem.

Success increments attempt_count and sets processed_at. Delivery failure increments attempt_count, stores a bounded error classification, and delays eligibility with exponential backoff from one second to a sixty-second cap. Failures are retried indefinitely; a malformed event remains pending rather than being silently discarded. Backoff prevents failed events from monopolizing a batch. Operators should inspect repeated failures and pending age. No dead-letter or loss-inducing maximum-attempt policy is introduced.

If PostgreSQL is available while DynamoDB is unavailable, API mutations still commit and events accumulate. The worker records failures, then delivers them after recovery. If PostgreSQL acknowledgement fails after DynamoDB accepts a write, the transaction rolls back and the event is retried. A crash has the same behavior.

## Idempotency and DynamoDB access patterns

The default table is activity_events:

| Access pattern                | Key/query                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------- |
| One Product or Content entity | pk = ENTITY#PRODUCT#uuid or ENTITY#CONTENT#uuid; sk = ISO timestamp#outbox UUID |
| Globally recent activity      | recent_activity GSI: gsiPk = RECENT; gsiSk = ISO timestamp#outbox UUID          |

The event's original timestamp and outbox ID determine its immutable storage key. Conditional Put with attribute_not_exists prevents replacement/duplication. A ConditionalCheckFailedException means that exact event identity already exists and is acknowledged as delivered. Other failures remain pending. The same event can safely be delivered repeatedly. Event IDs are generated once inside the original transaction, never during retries.

Entity queries use the table partition and may use strongly consistent reads. Global queries use one GSI and are eventually consistent; newly processed activity can take a short time to appear. Both query backwards by timestamp and ID. No scans or PostgreSQL outbox reads serve the activity API. The single RECENT partition supports the current modest administrative feed; higher throughput would require measured partitioning and merge pagination, not speculative infrastructure in this phase.

GET /api/v1/admin/activity returns data and nullable nextCursor. limit defaults to 20 and is capped at 100. Optional entityType and entityId must be supplied together (PRODUCT/CONTENT plus UUID). A cursor carries the DynamoDB LastEvaluatedKey as base64url JSON and is validated for shape and query scope. Cursor pagination is a live feed, not a snapshot. /admin/activity renders event type, entity, timestamp, actor and concise details with loading/error/empty states.

## Configuration and local operation

Local .env:

```dotenv
AWS_REGION=us-east-1
DYNAMODB_ENDPOINT=http://127.0.0.1:58000
DYNAMODB_ACTIVITY_TABLE=activity_events
DYNAMODB_HOST_PORT=58000
OUTBOX_POLL_INTERVAL_MS=2000
OUTBOX_BATCH_SIZE=25
```

Docker maps loopback port 58000 to DynamoDB Local port 8000 and retains its data in this Compose project's dynamodb_data volume. The client supplies non-secret local dummy credentials only when a local endpoint is configured. Production omits DYNAMODB_ENDPOINT and uses the AWS SDK default credentials provider chain; no production secrets are stored in configuration. Local endpoint overrides are rejected when NODE_ENV=production.

```sh
npm install
npm run db:up
npm run db:doctor
npm run db:migrate
npm run db:seed
npm run dynamodb:up
npm run dynamodb:init
npm run dynamodb:check
npm run worker:outbox
```

Run the API/client in another shell with npm run dev. Initialization is development-only, creates the table/GSI idempotently, waits for table availability, and checks the existing key schema. It does not drop/recreate an incompatible table. Credentials are not required from AWS for local commands. Initialization creates the table, not historical seed activity; make a real Product/Content mutation to create activity.

## Worker operation and health

SIGTERM/SIGINT abort active SDK calls and polling sleeps, stop new work, complete the current database bookkeeping, and close clients/pool. A failed or interrupted delivery remains pending. There is no worker HTTP listener. Worker JSON events include outboxEventId, eventType, attempt, durationMs for delivery; start/poll/shutdown events describe worker lifecycle. Failure diagnostics record error classifications, never raw event bodies, AWS credentials, or exception messages. outbox_delivered means DynamoDB accepted or already held the event; a subsequent PostgreSQL acknowledgement failure leaves it eligible for retry.

API readiness still checks only PostgreSQL. DynamoDB is not a mandatory dependency for core Product/Content mutations or public delivery. The activity API returns a safe 503 when its read store is unavailable. Worker poll failures are logged separately. Pending count, oldest pending timestamp, attempts, and last_error can be diagnosed with explicit SQL; the normal activity API never reads this delivery table.

```sql
SELECT count(*) AS pending, min(created_at) AS oldest_pending
FROM outbox_events WHERE processed_at IS NULL;
SELECT id, event_type, attempt_count, next_attempt_at, last_error
FROM outbox_events WHERE processed_at IS NULL
ORDER BY next_attempt_at, created_at, id LIMIT 20;
```

Tests cover transactional pairing/rollback, no-op lifecycle events, bounded worker polling, transient failure/retry, conditional duplicate delivery, mapping, scoped cursor validation, and safe activity errors. PostgreSQL integration uses TEST_DATABASE_URL. DynamoDB integration uses TEST_DYNAMODB_ENDPOINT and TEST_DYNAMODB_ACTIVITY_TABLE (default activity_events_test); initialize that separate local test table with the table environment override before running tests. Restricted environments can block Docker, sockets, or package installation; successful unit tests do not establish live delivery.

Redis, performance tooling, ECS/Fargate/RDS, Terraform, CI/CD, and Lambda are outside Phase 4.
