import { mkdir, writeFile } from 'node:fs/promises';
import { withDatabase } from '../database/cli.js';
import { performanceQueries } from './queries.js';
const variant = process.env.EXPLAIN_VARIANT ?? 'baseline';
if (!['baseline', 'candidate'].includes(variant))
  throw new Error('EXPLAIN_VARIANT must be baseline or candidate');
await withDatabase(async ({ pool }) => {
  const directory = new URL('../../../docs/performance/', import.meta.url);
  await mkdir(directory, { recursive: true });
  const metadata = await pool.query<{
    version: string;
    products: string;
    contents: string;
  }>(
    `SELECT version(), (SELECT count(*)::text FROM products) AS products, (SELECT count(*)::text FROM contents) AS contents`,
  );
  if (
    Number(metadata.rows[0]?.products) < 1000 ||
    Number(metadata.rows[0]?.contents) < 500
  )
    throw new Error(
      'Generate the representative dataset with npm run db:seed:performance before explaining queries',
    );
  for (const [name, statement] of Object.entries(performanceQueries)) {
    const text =
      variant === 'candidate'
        ? statement.text.replace(
            'filtered AS (',
            'filtered AS NOT MATERIALIZED (',
          )
        : statement.text;
    const result = await pool.query<{ 'QUERY PLAN': string }>(
      `EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT TEXT) ${text}`,
      statement.values,
    );
    await writeFile(
      new URL(`${variant}-${name}.txt`, directory),
      [
        `Recorded: ${new Date().toISOString()}`,
        JSON.stringify(metadata.rows[0]),
        `SQL: ${text}`,
        `Parameters: ${JSON.stringify(statement.values)}`,
        ...result.rows.map((row) => row['QUERY PLAN']),
      ].join('\n') + '\n',
    );
    console.log(
      JSON.stringify({ event: 'query_plan_recorded', variant, query: name }),
    );
  }
}, true);
