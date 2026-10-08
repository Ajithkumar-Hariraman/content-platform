import { readFileSync } from 'node:fs';
import type { PoolConfig } from 'pg';

export function readDatabaseConfig(
  env: NodeJS.ProcessEnv,
): PoolConfig | undefined {
  const names = [
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
  ] as const;
  const discrete = names.some((name) => env[name] !== undefined);
  if (env.DATABASE_URL !== undefined && discrete)
    throw new Error('Use DATABASE_URL or DB_* settings, never both');
  let database: PoolConfig | undefined;
  if (env.DATABASE_URL !== undefined) {
    try {
      const url = new URL(env.DATABASE_URL);
      if (
        !['postgres:', 'postgresql:'].includes(url.protocol) ||
        !url.hostname ||
        url.pathname.length < 2
      )
        throw new Error();
      database = { connectionString: env.DATABASE_URL };
    } catch {
      throw new Error('DATABASE_URL must be a PostgreSQL connection URL');
    }
  } else if (discrete) {
    if (names.some((name) => !env[name]?.trim()))
      throw new Error(
        'DB_HOST, DB_PORT, DB_NAME, DB_USER and DB_PASSWORD are all required',
      );
    const port = Number(env.DB_PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error('DB_PORT must be an integer between 1 and 65535');
    database = {
      host: env.DB_HOST!,
      port,
      database: env.DB_NAME!,
      user: env.DB_USER!,
      password: env.DB_PASSWORD!,
    };
  }
  if (env.DB_SSL_CA_FILE) {
    if (!database)
      throw new Error('DB_SSL_CA_FILE requires database configuration');
    database.ssl = {
      ca: readFileSync(env.DB_SSL_CA_FILE, 'utf8'),
      rejectUnauthorized: true,
    };
  }
  if (env.NODE_ENV === 'production') {
    if (!database)
      throw new Error('Production requires database configuration');
    if (!env.DB_SSL_CA_FILE)
      throw new Error(
        'Production requires DB_SSL_CA_FILE for verified database TLS',
      );
  }
  return database;
}
