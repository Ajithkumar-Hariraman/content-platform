import { withDatabase } from '../database/cli.js';
import { inTransaction } from '../database/transaction.js';
import { integerSetting } from '../config/performance.js';
await withDatabase(async ({ pool }) => {
  const products = integerSetting(
    process.env,
    'PERFORMANCE_PRODUCTS',
    20000,
    1000,
    500000,
  );
  const contents = integerSetting(
    process.env,
    'PERFORMANCE_CONTENTS',
    2000,
    500,
    100000,
  );
  const client = await pool.connect();
  try {
    await inTransaction(client, async () => {
      await client.query(`INSERT INTO categories (id,name,slug)
        SELECT overlay(overlay(md5('cloudops-perf-category-' || i) placing '4' from 13 for 1) placing '8' from 17 for 1)::uuid, 'Performance category ' || i, 'perf-category-' || i FROM generate_series(1,20) i
        ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, slug=EXCLUDED.slug`);
      await client.query(
        `INSERT INTO products (id,name,slug,description,price,status,category_id,created_at,updated_at)
        SELECT overlay(overlay(md5('cloudops-perf-product-' || i) placing '4' from 13 for 1) placing '8' from 17 for 1)::uuid,
          CASE WHEN i%17=0 THEN 'Performance storage ' ELSE 'Cloud compute ' END || i, 'perf-product-' || i,
          repeat('Capacity planning for cloud infrastructure. ', 8), ((i*37)%100000)::numeric/100,
          CASE WHEN i%10<7 THEN 'ACTIVE' WHEN i%10<9 THEN 'DRAFT' ELSE 'INACTIVE' END,
          overlay(overlay(md5('cloudops-perf-category-' || (i%20+1)) placing '4' from 13 for 1) placing '8' from 17 for 1)::uuid,
          timestamptz '2025-01-01' + i * interval '1 minute', timestamptz '2025-01-01' + i * interval '1 minute'
        FROM generate_series(1,$1::integer) i
        ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,price=EXCLUDED.price,status=EXCLUDED.status,category_id=EXCLUDED.category_id,created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at`,
        [products],
      );
      await client.query(
        `INSERT INTO contents (id,title,slug,summary,body,status,published_at,created_at,updated_at)
        SELECT overlay(overlay(md5('cloudops-perf-content-' || i) placing '4' from 13 for 1) placing '8' from 17 for 1)::uuid, 'Performance engineering reference ' || i, 'perf-content-' || i,
          'Capacity and reliability analysis ' || i, repeat('Analyze latency, throughput and saturation before changing capacity. ',80),
          CASE WHEN i%10<6 THEN 'PUBLISHED' WHEN i%10<8 THEN 'DRAFT' ELSE 'ARCHIVED' END,
          CASE WHEN i%10<6 THEN timestamptz '2025-01-01' + i * interval '1 hour' ELSE NULL END,
          timestamptz '2025-01-01' + i * interval '1 hour', timestamptz '2025-01-01' + i * interval '1 hour'
        FROM generate_series(1,$1::integer) i
        ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,summary=EXCLUDED.summary,body=EXCLUDED.body,status=EXCLUDED.status,published_at=EXCLUDED.published_at,created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at`,
        [contents],
      );
    });
    for (const table of ['categories', 'products', 'contents'])
      await client.query(`ANALYZE ${table}`);
    console.log(
      JSON.stringify({
        event: 'performance_dataset_generated',
        products,
        contents,
        categories: 20,
      }),
    );
  } finally {
    client.release();
  }
}, true);
