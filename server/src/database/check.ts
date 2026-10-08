import { withDatabase } from './cli.js';
await withDatabase(async (database) => {
  await database.checkConnection();
  const result = await database.pool.query(`
    SELECT p.id, p.name, p.price::text AS price, p.status, c.name AS category
    FROM products p JOIN categories c ON c.id = p.category_id
    ORDER BY p.name ASC, p.id ASC LIMIT 5
  `);
  const contents = await database.pool.query(
    'SELECT id, title, slug, status, published_at FROM contents ORDER BY slug LIMIT 10',
  );
  console.log(
    JSON.stringify({
      level: 'info',
      event: 'database_check_completed',
      products: result.rows,
      contents: contents.rows,
    }),
  );
});
