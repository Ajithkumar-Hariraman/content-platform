import { withDatabase } from './cli.js';
import { runMigrations } from './migrations.js';
await withDatabase(async ({ pool }) => {
  await runMigrations(pool);
});
