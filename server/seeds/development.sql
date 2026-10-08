INSERT INTO categories (id, name, slug) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Electronics', 'electronics'),
  ('22222222-2222-4222-8222-222222222222', 'Books', 'books'),
  ('33333333-3333-4333-8333-333333333333', 'Office', 'office')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = clock_timestamp()
WHERE categories.name IS DISTINCT FROM EXCLUDED.name;

INSERT INTO products (id, name, slug, description, price, status, category_id)
SELECT seed.id::uuid, seed.name, seed.slug, seed.description, seed.price::numeric,
  seed.status, categories.id
FROM (VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Wireless Headphones', 'wireless-headphones', 'Over-ear headphones with active noise cancellation.', '129.99', 'ACTIVE', 'electronics'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'Compact Smartphone', 'compact-smartphone', 'Unlocked smartphone with a 6-inch display and 128 GB storage.', '449.00', 'ACTIVE', 'electronics'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'USB-C Dock', 'usb-c-dock', 'Desktop dock with HDMI, Ethernet, and USB ports.', '79.50', 'DRAFT', 'electronics'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'Designing Data-Intensive Applications', 'designing-data-intensive-applications', 'A practical guide to reliable data systems.', '48.00', 'ACTIVE', 'books'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 'The Pragmatic Programmer', 'the-pragmatic-programmer', 'A guide to effective software development.', '39.95', 'ACTIVE', 'books'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6', 'Adjustable Desk Lamp', 'adjustable-desk-lamp', 'LED desk lamp with adjustable brightness.', '34.90', 'ACTIVE', 'office'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7', 'Ergonomic Keyboard', 'ergonomic-keyboard', 'Split keyboard with a comfortable wrist support.', '89.00', 'INACTIVE', 'office')
) AS seed(id, name, slug, description, price, status, category_slug)
JOIN categories ON categories.slug = seed.category_slug
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  status = EXCLUDED.status,
  category_id = EXCLUDED.category_id,
  updated_at = CASE WHEN
    (products.name, products.description, products.price, products.status, products.category_id)
    IS DISTINCT FROM
    (EXCLUDED.name, EXCLUDED.description, EXCLUDED.price, EXCLUDED.status, EXCLUDED.category_id)
    THEN clock_timestamp() ELSE products.updated_at END;

INSERT INTO contents (id,title,slug,summary,body,status,published_at,created_at,updated_at) VALUES
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','API reliability','api-reliability','Designing dependable HTTP services.','Bound dependency calls and use consistent error responses.\n\nReadiness checks confirm that the application can access its database.','PUBLISHED','2026-01-01T12:00:00Z','2026-01-01T12:00:00Z','2026-01-01T12:00:00Z'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','PostgreSQL operations','postgresql-operations','Operational practices for PostgreSQL.','Use parameterized SQL and explicit columns.\n\nObserve query latency before adding indexes.','PUBLISHED','2026-01-02T12:00:00Z','2026-01-02T12:00:00Z','2026-01-02T12:00:00Z'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3','Publishing workflow','publishing-workflow','An editorial draft.','Draft material awaiting review.','DRAFT',NULL,'2026-01-03T12:00:00Z','2026-01-03T12:00:00Z'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4','Retired service guide','retired-service-guide','Historical service documentation.','This guide has been retired.','ARCHIVED','2025-01-01T12:00:00Z','2025-01-01T12:00:00Z','2026-01-04T12:00:00Z')
ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title,summary=EXCLUDED.summary,body=EXCLUDED.body,status=EXCLUDED.status,published_at=EXCLUDED.published_at,
 updated_at=CASE WHEN (contents.title,contents.summary,contents.body,contents.status,contents.published_at) IS DISTINCT FROM (EXCLUDED.title,EXCLUDED.summary,EXCLUDED.body,EXCLUDED.status,EXCLUDED.published_at) THEN clock_timestamp() ELSE contents.updated_at END;
