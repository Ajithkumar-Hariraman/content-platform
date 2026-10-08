CREATE TABLE contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(200) NOT NULL CHECK (length(btrim(title)) > 0),
  slug varchar(200) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  summary text CHECK (length(summary) <= 5000),
  body text NOT NULL CHECK (length(btrim(body)) > 0 AND length(body) <= 50000),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'PUBLISHED' OR published_at IS NOT NULL)
);
CREATE INDEX contents_public_published_idx ON contents (published_at DESC, id) WHERE status = 'PUBLISHED';
