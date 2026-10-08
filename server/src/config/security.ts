export interface SecurityConfig {
  production: boolean;
  sessionLifetimeMs: number;
  docsEnabled: boolean;
}
export function readSecurityConfig(env: NodeJS.ProcessEnv): SecurityConfig {
  const hours = Number(env.SESSION_LIFETIME_HOURS ?? '8');
  if (!Number.isInteger(hours) || hours < 1 || hours > 24)
    throw new Error('SESSION_LIFETIME_HOURS must be between 1 and 24');
  if (
    env.ENABLE_API_DOCS !== undefined &&
    !['true', 'false'].includes(env.ENABLE_API_DOCS)
  )
    throw new Error('ENABLE_API_DOCS must be true or false');
  const production = env.NODE_ENV === 'production';
  return {
    production,
    sessionLifetimeMs: hours * 3600000,
    docsEnabled:
      env.ENABLE_API_DOCS === 'true' ||
      (!production && env.ENABLE_API_DOCS !== 'false'),
  };
}
