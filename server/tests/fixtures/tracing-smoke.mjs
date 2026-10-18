import express from 'express';
import pg from 'pg';
import { requestLogging } from '../../src/middleware/request-logging.ts';
import { shutdownTracing } from '../../src/observability/tracing.ts';
const app = express();
app.use(requestLogging);
app.get('/smoke/:id', async (_req, res) => {
  const pool = new pg.Pool({
    host: '127.0.0.1',
    port: 1,
    user: 'secret-user',
    password: 'secret-password',
    connectionTimeoutMillis: 100,
  });
  try {
    await pool.query('SELECT secret-sql');
  } catch {
    /* Expected unavailable dependency. */
  }
  await pool.end();
  res.json({ ok: true });
});
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const response = await fetch(
  `http://127.0.0.1:${server.address().port}/smoke/private-id?token=secret-token`,
);
if (response.status !== 200) throw new Error('API failed');
await new Promise((resolve) => server.close(resolve));
await shutdownTracing();
