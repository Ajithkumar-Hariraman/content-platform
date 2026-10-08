export interface EventConfig {
  region: string;
  endpoint?: string;
  table: string;
  pollIntervalMs: number;
  batchSize: number;
}
function integer(
  value: string | undefined,
  fallback: number,
  max: number,
  name: string,
): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max)
    throw new Error(`${name} must be an integer between 1 and ${max}`);
  return parsed;
}
export function readEventConfig(env: NodeJS.ProcessEnv): EventConfig {
  const region = env.AWS_REGION ?? 'us-east-1';
  if (!/^[a-z]{2}(?:-[a-z]+)+-\d+$/.test(region))
    throw new Error('AWS_REGION is invalid');
  const table = env.DYNAMODB_ACTIVITY_TABLE ?? 'activity_events';
  if (!/^[a-zA-Z0-9_.-]{3,255}$/.test(table))
    throw new Error('DYNAMODB_ACTIVITY_TABLE is invalid');
  const endpoint = env.DYNAMODB_ENDPOINT;
  if (endpoint) {
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      throw new Error('DYNAMODB_ENDPOINT must be a valid HTTP origin');
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error(
        'DYNAMODB_ENDPOINT must be an HTTP origin without credentials',
      );
    if (env.NODE_ENV === 'production')
      throw new Error(
        'DYNAMODB_ENDPOINT is only supported for local development and tests',
      );
  }
  return {
    region,
    table,
    ...(endpoint ? { endpoint } : {}),
    pollIntervalMs: integer(
      env.OUTBOX_POLL_INTERVAL_MS,
      2000,
      60000,
      'OUTBOX_POLL_INTERVAL_MS',
    ),
    batchSize: integer(env.OUTBOX_BATCH_SIZE, 25, 100, 'OUTBOX_BATCH_SIZE'),
  };
}
