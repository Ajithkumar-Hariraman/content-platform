import { createConnection } from 'node:net';
import { readConfig } from '../config/env.js';
import { createDatabase } from './pool.js';
const config = readConfig(process.env);
if (!config.database) throw new Error('Database configuration is required');
const url = config.databaseUrl ? new URL(config.databaseUrl) : undefined;
const host = url?.hostname ?? config.database.host!;
const port = Number(url?.port || config.database.port || 5432);
const tcp = await new Promise<boolean>((resolve) => {
  const socket = createConnection({ host, port });
  const finish = (ok: boolean) => {
    socket.destroy();
    resolve(ok);
  };
  socket.setTimeout(5000, () => finish(false));
  socket.once('connect', () => finish(true));
  socket.once('error', () => finish(false));
});
const database = createDatabase(config.database);
let authenticated = false;
try {
  await database.checkConnection();
  authenticated = true;
} catch {
  process.exitCode = 1;
} finally {
  await database.close();
}
console.log(JSON.stringify({ host, port, tcp, authenticated }));
if (!authenticated)
  console.error(
    'PostgreSQL unavailable or authentication failed. Check project .env and run npm run db:up, then npm run db:doctor.',
  );
