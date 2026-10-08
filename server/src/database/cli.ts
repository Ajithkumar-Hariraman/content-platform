import { readConfig } from '../config/env.js';
import { createDatabase } from './pool.js';

export async function withDatabase(
  operation: (database: ReturnType<typeof createDatabase>) => Promise<void>,
  developmentOnly = false,
): Promise<void> {
  const config = readConfig(process.env);
  if (!config.database)
    throw new Error('Database configuration is required for database commands');
  if (developmentOnly && config.nodeEnv !== 'development')
    throw new Error('Seeding is only permitted in NODE_ENV=development');
  const database = createDatabase(config.database);
  try {
    try {
      await database.checkConnection();
    } catch {
      throw new Error(
        'PostgreSQL unavailable or authentication failed. Run npm run db:doctor and check the project database on 127.0.0.1:55433.',
      );
    }
    await operation(database);
  } finally {
    await database.close();
  }
}
