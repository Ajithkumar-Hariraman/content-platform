export function redact(
  message: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  let result = message.replace(
    /postgres(?:ql)?:\/\/[^\s]+/gi,
    '[REDACTED_DATABASE_URL]',
  );
  if (env.DB_PASSWORD)
    result = result.replaceAll(env.DB_PASSWORD, '[REDACTED]');
  const password = env.POSTGRES_PASSWORD;
  if (password) result = result.replaceAll(password, '[REDACTED]');
  const databaseUrl = env.DATABASE_URL;
  if (databaseUrl) {
    try {
      const encodedPassword = new URL(databaseUrl).password;
      if (encodedPassword) {
        result = result.replaceAll(encodedPassword, '[REDACTED]');
        result = result.replaceAll(
          decodeURIComponent(encodedPassword),
          '[REDACTED]',
        );
      }
    } catch {
      return result;
    }
  }
  return result;
}
