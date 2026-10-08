export function integerSetting(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = Number(env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  return value;
}
export function readPerformanceConfig(env: NodeJS.ProcessEnv) {
  for (const name of ['CACHE_ENABLED', 'PERFORMANCE_MODE'])
    if (env[name] !== undefined && !['true', 'false'].includes(env[name]!))
      throw new Error(`${name} must be true or false`);
  if (env.PERFORMANCE_MODE === 'true' && env.NODE_ENV !== 'development')
    throw new Error('PERFORMANCE_MODE is permitted only in development');
  const redisUrl = env.REDIS_URL;
  if (redisUrl) {
    try {
      if (!['redis:', 'rediss:'].includes(new URL(redisUrl).protocol))
        throw new Error('Invalid protocol');
    } catch {
      throw new Error('REDIS_URL must be a valid redis or rediss URL');
    }
  }
  return {
    cacheEnabled: env.CACHE_ENABLED !== 'false' && Boolean(redisUrl),
    redisUrl,
    ttlSeconds: integerSetting(env, 'CACHE_TTL_SECONDS', 60, 1, 3600),
    cacheTimeoutMs: integerSetting(env, 'CACHE_TIMEOUT_MS', 150, 10, 5000),
    slowRequestMs: integerSetting(
      env,
      'SLOW_REQUEST_THRESHOLD_MS',
      500,
      1,
      60000,
    ),
    performanceMode: env.PERFORMANCE_MODE === 'true',
  };
}
export function readPoolConfig(env: NodeJS.ProcessEnv) {
  return {
    max: integerSetting(env, 'DB_POOL_MAX', 10, 1, 100),
    idleTimeoutMillis: integerSetting(
      env,
      'DB_POOL_IDLE_TIMEOUT_MS',
      30000,
      1000,
      600000,
    ),
    connectionTimeoutMillis: integerSetting(
      env,
      'DB_POOL_CONNECTION_TIMEOUT_MS',
      5000,
      100,
      60000,
    ),
  };
}
