# Database

## Schema

PostgreSQL is the transactional system of record. Products reference Categories through a required foreign key; category deletion is restricted while products reference it.

| Table               | Columns                                                                                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `categories`        | `id uuid`, `name varchar(120)`, `slug varchar(160)`, `created_at timestamptz`, `updated_at timestamptz`                                                                                        |
| `products`          | `id uuid`, `name varchar(200)`, `slug varchar(200)`, nullable `description text`, `price numeric(12,2)`, `status text`, `category_id uuid`, `created_at timestamptz`, `updated_at timestamptz` |
| `schema_migrations` | `name text`, `checksum text`, `applied_at timestamptz`                                                                                                                                         |

Domain IDs have primary keys and default to `gen_random_uuid()`. Catalog columns except description are NOT NULL. Slugs are unique per table and restricted to lowercase letters/digits separated by single hyphens. Names must contain non-whitespace content. Descriptions are bounded to 5,000 characters.

Prices are nonnegative `numeric(12,2)`, supporting up to `9999999999.99`. The API accepts decimal strings with up to two fractional digits and returns PostgreSQL's fixed-scale string representation. It rejects excessive precision before PostgreSQL can round it. Neither SQL storage nor JSON transport converts monetary values to floating-point numbers. Currency conversion and multi-currency modeling are outside the current scope; no currency is inferred by the UI.

Status is text with a CHECK constraint allowing only `DRAFT`, `ACTIVE`, and `INACTIVE`. A CHECK constraint keeps this small value set explicit in SQL without a separate lookup table or PostgreSQL enum lifecycle.

Timestamp defaults are `now()`. Repository updates explicitly set `updated_at` with `clock_timestamp()`. Direct maintenance SQL must maintain that column itself; no implicit trigger is installed.

## Constraints and indexes

- Primary-key B-tree indexes on category/product IDs and migration name.
- Unique B-tree indexes on category and product slugs enforce identity and support slug-based seed upserts.
- `products_category_id_idx` supports category-filter access and foreign-key maintenance.
- The product category foreign key prevents orphaned records and uses `ON DELETE RESTRICT`.
- CHECK constraints enforce nonnegative prices, valid status, names, slugs, and description length.

There is no status-only index: its small value set does not justify an index before workload measurement. Search indexes, composite indexes, EXPLAIN ANALYZE experiments, and benchmarks are deferred to the performance phase.

## Migrations

```sh
npm run db:up
npm run db:migrate
```

The internal runner discovers numbered SQL files in `server/migrations`, sorts them by filename, acquires a PostgreSQL advisory lock, and records SHA-256 checksums in `schema_migrations`. Each migration and its tracking insert run in one transaction. A failed migration rolls back; already applied migrations are skipped. Modified or missing applied files and newly introduced files preceding the latest applied migration cause failure.

Use zero-padded, increasing filenames such as `001_catalog.sql` and `005_next_change.sql`. Applied files are immutable; introduce later changes in a new migration. Run migrations as an explicit deployment step, not inside HTTP startup. This runner has no automatic down-migration capability. SQL requiring execution outside a transaction needs a deliberate later runner change.

## Development seed

```sh
npm run db:seed
npm run db:check
```

The seed is allowed only when `NODE_ENV=development`; operators must target a development database. One transaction upserts Electronics, Books, Office, and seven products, plus two published contents, one draft, and one archived item. Known seed slugs receive canonical values; unrelated records are preserved. Seed records use fixed IDs on first insertion and keep existing IDs when a slug already exists. Repeated execution does not duplicate records or change timestamps when values are unchanged.

Re-running the seed restores edited seed records but does not remove unrelated records. It does not rename records whose slugs were changed manually; the canonical slug is inserted again. Seeding is never part of application startup.

`db:check` executes `SELECT 1` and an explicit-column join returning up to five catalog records plus ten content records. It fails if connectivity or the catalog schema is unavailable.

## Repositories and pool

`CategoryRepository` selects categories and maps timestamps. `ProductRepository` implements collection reads, item reads, insertion, partial update, and deletion. Selected and returned columns are explicit. Dynamic SQL identifiers are chosen only from code-owned allow-lists; all input values are parameters.

The list query applies literal case-insensitive substring search over name/description, category/status filters, deterministic ordering, and offset pagination. A single statement returns both total count and page rows, including empty pages. Numeric sorting uses the original numeric price rather than its transport string.

The shared `pg` pool bounds concurrent connections, connection acquisition time, and idle lifetime. It logs idle-client errors and exposes connectivity and close methods. Repositories borrow connections through `pool.query`; migrations and seeds acquire a client for transaction scope and release it in `finally` blocks. Graceful process shutdown closes the pool.

Product writes use a transaction pairing the domain statement with an outbox insert. Category existence checks improve error messages; the foreign key protects against concurrent category removal. Content mutations use the same transaction helper; publish/archive also lock the current lifecycle row. Migration and seed transactions already protect real multi-statement workflows.

## Database integration testing

Provide `TEST_DATABASE_URL` for a dedicated disposable test database and run `npm test`. Integration tests apply migrations twice to verify repeatability, create uniquely identified test records, exercise repository/service behavior, and remove their own records. The integration test is skipped when the variable is absent. Never point it at production. The development database's credentials and URL are not silently reused for tests.

## Content schema: 002_contents.sql

`contents`: UUID primary key (gen_random_uuid), required title varchar(200), required unique slug varchar(200), nullable summary text (5,000 characters), required body text (1–50,000 characters with non-whitespace content), required status text (default DRAFT), nullable published_at timestamptz, and created_at/updated_at timestamptz defaults now(). CHECK constraints allow only DRAFT/PUBLISHED/ARCHIVED and require a publication timestamp for PUBLISHED rows. Title and slug validation matches the API.

Primary/unique indexes support admin ID and public slug lookups. A partial `(published_at DESC, id)` index for PUBLISHED rows supports the default public feed. There are no speculative full-text or status-only indexes. List SQL produces count/page in one snapshot and orders ties by ID. Search is a literal substring in title/summary with escaped wildcards. Sorting uses a code-owned allow-list.

Creation inserts editorial fields and relies on the database draft default. PATCH updates only supplied editorial columns and updated_at. Publish atomically updates rows in DRAFT/PUBLISHED, assigns published_at with clock_timestamp on first publication, and preserves timestamps on repeated publication. Archive preserves publication history and changes status/updated_at only when needed. ContentService owns transition rules and maps missing/conflicting operations to application errors.

The original 001_catalog.sql is unchanged. Both migrations remain checksum tracked. Development seeds upsert canonical content slugs without changing unchanged timestamps. Integration tests use TEST_DATABASE_URL only and test content constraints, duplicate slugs, persistence, visibility, and lifecycle against PostgreSQL when available.

## Outbox schema: 003_outbox_events.sql

outbox_events stores UUID event identity, constrained event/entity types, entity UUID, JSONB event payload, created_at, nullable processed_at, nonnegative attempt_count, nullable bounded last_error, and next_attempt_at. Entity IDs intentionally have no domain foreign key so deleted entities retain their audit history. A pending-only (next_attempt_at, created_at, id) index supports eligible polling. Domain mutation and outbox insertion commit together; the worker's locked delivery attempt records processed or retry state in a separate transaction. See [events](events.md).

## Users and sessions: 004_users_sessions.sql

users has UUID identity, normalized unique email, password_hash, constrained ADMIN/EDITOR/VIEWER role, ACTIVE/DISABLED status, and timestamp defaults. user_sessions has UUID identity, required user FK (cascade delete), unique SHA-256 token_hash, csrf_token_hash, expiry, last_seen_at, nullable revoked_at, and created_at. Expiry must exceed creation; token hashes are 64-character hex strings. The token unique index supports authentication; a partial active user_id index supports session revocation and the FK. No speculative status/email-search indexes are added.

Passwords and tokens are never selected into public responses. Access changes serialize with an advisory transaction lock to protect the last active administrator, lock the selected user, update access, and revoke sessions atomically. Password updates compare the old hash and revoke sessions in the same transaction. Login locks the user and rechecks its active credential before creating a session. Session expiry is absolute; last_seen_at does not extend it. See [security](security.md).

## Cache generation and performance data

Migration 005 adds public_cache_versions and statement triggers for Product/Content/Category changes; generation updates commit or roll back with the domain write. It adds no speculative read indexes. The separate development-only performance generator upserts deterministic records and ANALYZEs current tables. EXPLAIN uses production query builders; candidate CTE inlining remains experimental pending real plans. See [performance](performance.md).
