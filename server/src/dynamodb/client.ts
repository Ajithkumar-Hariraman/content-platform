import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { EventConfig } from '../config/events.js';
export function createActivityDatabase(config: EventConfig) {
  const client = new DynamoDBClient({
    region: config.region,
    maxAttempts: 2,
    requestHandler: { connectionTimeout: 1000, requestTimeout: 3000 },
    ...(config.endpoint
      ? {
          endpoint: config.endpoint,
          credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
        }
      : {}),
  });
  const documentClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
  return { client, documentClient, close: () => client.destroy() };
}
