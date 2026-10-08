CREATE TABLE outbox_events (
  id uuid PRIMARY KEY,
  event_type text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('PRODUCT', 'CONTENT')),
  entity_id uuid NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL,
  processed_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error varchar(200),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((entity_type = 'PRODUCT' AND event_type IN ('PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_DELETED'))
    OR (entity_type = 'CONTENT' AND event_type IN ('CONTENT_CREATED', 'CONTENT_UPDATED', 'CONTENT_PUBLISHED', 'CONTENT_ARCHIVED', 'CONTENT_DELETED')))
);
CREATE INDEX outbox_events_pending_idx ON outbox_events (next_attempt_at, created_at, id) WHERE processed_at IS NULL;
